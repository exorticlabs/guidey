import json
from pathlib import Path
from typing import Dict, Any, List
from config import WORKSPACES_DIR, get_safe_workspace_path, sanitize_identifier
from core.agent import AssessmentAgent, StudentModelAgent
from skills.teaching import TutorManager

class EvaluationManager:
    """Manages generation of adaptive assessments, grading, mistakes database, and student mastery updates."""
    
    def __init__(self):
        self.assessment_agent = AssessmentAgent()
        self.student_model_agent = StudentModelAgent()
        self.tutor_manager = TutorManager()

    def _get_assessment_path(self, workspace_id: str, student_id: str, topic_id: str) -> Path:
        eval_dir = get_safe_workspace_path(workspace_id, student_id) / "assessments"
        eval_dir.mkdir(parents=True, exist_ok=True)
        safe_topic = sanitize_identifier(topic_id, "default_topic")
        return eval_dir / f"curr_{safe_topic}.json"

    def generate_assessment(self, workspace_id: str, student_id: str, topic_id: str, topic_name: str) -> Dict[str, Any]:
        """Generates an adaptive 3-question micro-assessment based on current student mastery."""
        profile = self.tutor_manager.load_student_profile(workspace_id, student_id)
        current_mastery = profile.get("mastery", {}).get(topic_id, 0)
        
        prompt_input = f"Topic Name: {topic_name} (ID: {topic_id})\nStudent Current Mastery: {current_mastery}/100"
        
        result = self.assessment_agent.run_json(prompt_input)
        if "error" in result or "questions" not in result:
            # Fallback questions if LLM fails or formats incorrectly
            result = {
                "questions": [
                    {
                        "id": "q1",
                        "type": "conceptual",
                        "question": f"What is the core purpose of {topic_name}?",
                        "options": [
                            "To solve problems efficiently.",
                            "To memorize formulas.",
                            "To skip prerequisite concepts.",
                            "None of the above."
                        ],
                        "correct_answer": "To solve problems efficiently.",
                        "explanation": f"{topic_name} is used to structure solutions and solve practical problems systematically."
                    },
                    {
                        "id": "q2",
                        "type": "application",
                        "question": f"When applying {topic_name}, what is the first step?",
                        "options": [
                            "Identify constraints and inputs.",
                            "Guess the final answer.",
                            "Draw a random flowchart.",
                            "Skip straight to coding."
                        ],
                        "correct_answer": "Identify constraints and inputs.",
                        "explanation": "Understanding inputs and boundary conditions is critical before applying the concept."
                    },
                    {
                        "id": "q3",
                        "type": "reasoning",
                        "question": f"Which of the following describes a critical failure mode or edge case of {topic_name}?",
                        "options": [
                            "Infinite loops or division by zero.",
                            "Having a nice visual explanation.",
                            "Having met all prerequisites.",
                            "Learning too fast."
                        ],
                        "correct_answer": "Infinite loops or division by zero.",
                        "explanation": "Edge cases often involve boundary failures, overflows, or illegal mathematical operations."
                    }
                ]
            }

        # Save full assessment with answers to disk for grading
        path = self._get_assessment_path(workspace_id, student_id, topic_id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=True)

        # Create client-safe version (remove correct_answer and explanation)
        safe_questions = []
        for q in result["questions"]:
            safe_q = {
                "id": q["id"],
                "type": q["type"],
                "question": q["question"],
                "options": q["options"]
            }
            safe_questions.append(safe_q)
            
        return {"questions": safe_questions}

    def submit_assessment(self, workspace_id: str, student_id: str, topic_id: str, answers: Dict[str, str]) -> Dict[str, Any]:
        """Grades the submitted answers, logs mistakes, and updates the student mastery graph."""
        path = self._get_assessment_path(workspace_id, student_id, topic_id)
        if not path.exists():
            return {"error": "No active assessment session found. Please request an assessment first."}

        with open(path, "r", encoding="utf-8") as f:
            full_assessment = json.load(f)

        profile = self.tutor_manager.load_student_profile(workspace_id, student_id)
        current_mastery = profile.get("mastery", {}).get(topic_id, 0)
        
        results = []
        correct_count = 0
        questions = full_assessment.get("questions", [])
        
        # Grade questions locally first
        for q in questions:
            qid = q["id"]
            correct = q["correct_answer"]
            student_choice = answers.get(qid, "")
            is_correct = student_choice.strip().lower() == correct.strip().lower()
            
            if is_correct:
                correct_count += 1
                
            results.append({
                "id": qid,
                "type": q["type"],
                "question": q["question"],
                "options": q["options"],
                "correct_answer": correct,
                "student_answer": student_choice,
                "is_correct": is_correct,
                "explanation": q["explanation"]
            })

        # Ask the StudentModelAgent to evaluate the submission and adjust mastery
        eval_message = f"Topic: {topic_id}\nCurrent Student Mastery Score: {current_mastery}/100\nAssessment Submission details:\n"
        for r in results:
            outcome = 'CORRECT' if r.get('is_correct') else 'INCORRECT'
            eval_message += (
                f"- Question ({r.get('type')}): {r.get('question')}\n"
                f"  Student choice: '{r.get('student_answer')}'\n"
                f"  Correct choice: '{r.get('correct_answer')}'\n"
                f"  Outcome: {outcome}\n"
            )
        model_result = self.student_model_agent.run_json(eval_message)
        
        updated_mastery = current_mastery
        reasoning = "Automatic grading applied."
        misconceptions = []
        
        if "error" not in model_result:
            updated_mastery = model_result.get("updated_mastery", current_mastery)
            reasoning = model_result.get("reasoning", "")
            misconceptions = model_result.get("misconceptions_found", [])
        else:
            # Fallback simple scoring logic if LLM fails
            pct = correct_count / len(questions) if questions else 0
            if pct == 1.0:
                updated_mastery = min(100, current_mastery + 15)
                reasoning = "All questions answered correctly. Mastery increased."
            elif pct >= 0.6:
                updated_mastery = min(100, current_mastery + 5)
                reasoning = "Majority of questions answered correctly. Mastery increased slightly."
            else:
                updated_mastery = max(0, current_mastery - 15)
                reasoning = "Multiple questions missed. Mastery decreased."
                misconceptions = ["General topic weakness"]

        # Log mistakes database
        if misconceptions:
            for mis in misconceptions:
                profile["mistakes"].append({
                    "topic_id": topic_id,
                    "misconception": mis,
                    "question_context": [r["question"] for r in results if not r["is_correct"]]
                })
                # Add to weak concepts list if not already present
                if topic_id not in profile["weak_concepts"]:
                    profile["weak_concepts"].append(topic_id)
        else:
            # If they did well and got high mastery, remove from weak concepts
            if updated_mastery >= 70 and topic_id in profile["weak_concepts"]:
                profile["weak_concepts"].remove(topic_id)

        # Update mastery score in profile
        profile["mastery"][topic_id] = updated_mastery
        
        # Save assessment history
        if "assessment_history" not in profile:
            profile["assessment_history"] = []
        profile["assessment_history"].append({
            "topic_id": topic_id,
            "score": int((correct_count / len(questions)) * 100) if questions else 0,
            "updated_mastery": updated_mastery,
            "timestamp": model_result.get("timestamp", "")
        })

        # Save student profile
        self.tutor_manager.save_student_profile(workspace_id, student_id, profile)

        # Cleanup current assessment cache
        try:
            path.unlink()
        except Exception:
            pass

        return {
            "ok": True,
            "correct_count": correct_count,
            "total_questions": len(questions),
            "results": results,
            "previous_mastery": current_mastery,
            "new_mastery": updated_mastery,
            "misconceptions_found": misconceptions,
            "reasoning": reasoning
        }

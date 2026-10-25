import os
import sys
from pathlib import Path
# Ensure correct modules are loaded
sys.path.insert(0, str(Path(__file__).parent.absolute()))
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from config import PROJECT_ROOT, UPLOAD_DIR, sanitize_identifier
from skills.curriculum import CurriculumManager
from skills.research import ResearchManager
from skills.teaching import TutorManager, ProjectMentorManager
from skills.evaluation import EvaluationManager
from skills.animation import AnimationManager
import uuid

app = FastAPI(title="Learning Operating System API", version="1.0.0")

# Managers instantiation
curriculum_manager = CurriculumManager()
research_manager = ResearchManager()
tutor_manager = TutorManager()
project_mentor_manager = ProjectMentorManager()
evaluation_manager = EvaluationManager()
animation_manager = AnimationManager()

# Ensure static directory exists
STATIC_DIR = PROJECT_ROOT / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)


# --- Request/Response Models ---
class SyllabusTextRequest(BaseModel):
    syllabus_text: str
    workspace_id: str = "default"

class ChatRequest(BaseModel):
    topic_id: str
    student_message: str
    workspace_id: str = "default"
    student_id: str = "solo_learner"

class SwitchWorkspaceRequest(BaseModel):
    workspace_id: str
    student_id: str = "solo_learner"
    learning_style: Optional[str] = None
    interests: Optional[List[str]] = None

class AssessmentStartRequest(BaseModel):
    topic_id: str
    workspace_id: str = "default"
    student_id: str = "solo_learner"

class AssessmentSubmitRequest(BaseModel):
    topic_id: str
    answers: Dict[str, str]
    workspace_id: str = "default"
    student_id: str = "solo_learner"

class ProjectMentorRequest(BaseModel):
    project_id: str
    student_message: str
    workspace_id: str = "default"

class MilestoneCompleteRequest(BaseModel):
    project_id: str
    milestone_index: int
    completed: bool
    workspace_id: str = "default"

class DynamicResearchRequest(BaseModel):
    query: str


# --- Endpoints ---

@app.post("/api/syllabus/upload-text")
def upload_syllabus_text(req: SyllabusTextRequest):
    """Processes plain-text syllabus, creates knowledge graph DAG, and resets student masteries."""
    if not req.syllabus_text.strip():
        raise HTTPException(status_code=400, detail="Syllabus text cannot be empty.")
        
    result = curriculum_manager.parse_and_save_syllabus(req.workspace_id, req.syllabus_text)
    if "error" in result:
        raise HTTPException(status_code=500, detail=f"LLM failed to parse syllabus: {result['error']}")
        
    # Reset/initialize student profile for this new curriculum
    profile = tutor_manager.load_student_profile(req.workspace_id, "solo_learner")
    profile["mastery"] = {topic["id"]: 0 for topic in result.get("topics", [])}
    profile["weak_concepts"] = []
    profile["mistakes"] = []
    tutor_manager.save_student_profile(req.workspace_id, "solo_learner", profile)
    
    return {"ok": True, "curriculum": result}


@app.post("/api/syllabus/upload-file")
async def upload_syllabus_file(
    file: UploadFile = File(...), 
    workspace_id: str = Form("default")
):
    """Handles syllabus file upload with isolated UUID storage and strict path validation."""
    safe_ws = sanitize_identifier(workspace_id, "default")
    clean_filename = Path(file.filename).name
    isolated_filename = f"{safe_ws}_{uuid.uuid4().hex[:12]}_{clean_filename}"
    file_path = (UPLOAD_DIR / isolated_filename).resolve()

    try:
        file_path.relative_to(UPLOAD_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid filename or path traversal detected.")

    try:
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())
            
        # Read contents based on extension
        syllabus_text = ""
        if clean_filename.lower().endswith(".pdf"):
            try:
                import pypdf
                reader = pypdf.PdfReader(file_path)
                text_list = [page.extract_text() for page in reader.pages if page.extract_text()]
                syllabus_text = "\n".join(text_list)
            except Exception as e:
                raise HTTPException(
                    status_code=500, 
                    detail=f"PDF parsing error. Please install pypdf or upload plain TXT: {str(e)}"
                )
        else:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                syllabus_text = f.read()

        if not syllabus_text.strip():
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        result = curriculum_manager.parse_and_save_syllabus(safe_ws, syllabus_text)
        if "error" in result:
            raise HTTPException(status_code=500, detail=f"LLM parsing error: {result['error']}")

        # Reset/initialize student profile
        profile = tutor_manager.load_student_profile(safe_ws, "solo_learner")
        profile["mastery"] = {topic["id"]: 0 for topic in result.get("topics", [])}
        profile["weak_concepts"] = []
        profile["mistakes"] = []
        tutor_manager.save_student_profile(workspace_id, "solo_learner", profile)
        
        return {"ok": True, "filename": file.filename, "curriculum": result}
        
    finally:
        # Cleanup temp file
        if file_path.exists():
            try:
                os.remove(file_path)
            except Exception:
                pass


@app.get("/api/curriculum/graph")
def get_curriculum_graph(workspace_id: str = "default", student_id: str = "solo_learner"):
    """Returns the topological learning path and the student's mastery graph."""
    try:
        order = curriculum_manager.get_topological_sort(workspace_id)
        profile = tutor_manager.load_student_profile(workspace_id, student_id)
        return {
            "topics": order,
            "mastery": profile.get("mastery", {}),
            "profile": {
                "learning_style": profile.get("learning_style", "visual"),
                "interests": profile.get("interests", []),
                "weak_concepts": profile.get("weak_concepts", []),
                "mistakes_count": len(profile.get("mistakes", []))
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/workspace/switch")
def switch_workspace(req: SwitchWorkspaceRequest):
    """Updates learning preferences, styles, and creates profile config."""
    profile = tutor_manager.load_student_profile(req.workspace_id, req.student_id)
    if req.learning_style:
        profile["learning_style"] = req.learning_style
    if req.interests is not None:
        profile["interests"] = req.interests
    tutor_manager.save_student_profile(req.workspace_id, req.student_id, profile)
    return {"ok": True, "profile": profile}


@app.post("/api/tutor/chat")
def tutor_chat(req: ChatRequest):
    """Accepts chat prompts, performs dependency routing, and gets tutor feedback."""
    try:
        # Check if student requested web search directly
        cleaned_msg = req.student_message.strip()
        if cleaned_msg.lower().startswith("search:"):
            # Route to dynamic research engine directly
            query = cleaned_msg[7:].strip()
            res = research_manager.perform_dynamic_research(query)
            return {
                "response": res.get("synthesis", "Error performing research."),
                "diverted": False,
                "active_topic_id": req.topic_id,
                "sources": res.get("sources", [])
            }

        # Otherwise run the standard Socratic Tutor Loop
        result = tutor_manager.get_tutor_response(
            workspace_id=req.workspace_id,
            student_id=req.student_id,
            topic_id=req.topic_id,
            student_message=req.student_message
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tutor/animations")
def get_topic_animations(topic_id: str, topic_name: str, workspace_id: str = "default"):
    """Fetches visual frames for the given topic."""
    try:
        return animation_manager.get_animation(workspace_id, topic_id, topic_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/assessments/start")
def start_assessment(req: AssessmentStartRequest):
    """Generates a client-safe adaptive micro-assessment."""
    try:
        topics = curriculum_manager.get_topics_dict(req.workspace_id)
        topic = topics.get(req.topic_id)
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found in curriculum.")
            
        assessment = evaluation_manager.generate_assessment(
            req.workspace_id, req.student_id, req.topic_id, topic["name"]
        )
        return assessment
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/assessments/submit")
def submit_assessment(req: AssessmentSubmitRequest):
    """Grades MCQ choices, updates mastery score, and triggers mistake db analysis."""
    try:
        res = evaluation_manager.submit_assessment(
            req.workspace_id, req.student_id, req.topic_id, req.answers
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/project/mentor")
def project_mentor(req: ProjectMentorRequest):
    """Processes project mentor dialogue, tracking milestones and guides coding."""
    try:
        res = project_mentor_manager.get_mentor_response(
            workspace_id=req.workspace_id,
            project_id=req.project_id,
            student_message=req.student_message
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/project/state")
def get_project_state(project_id: str, workspace_id: str = "default"):
    """Loads current project state details."""
    try:
        return project_mentor_manager.load_project(workspace_id, project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/project/complete-milestone")
def complete_project_milestone(req: MilestoneCompleteRequest):
    """Directly completes or toggles a project milestone."""
    try:
        proj = project_mentor_manager.load_project(req.workspace_id, req.project_id)
        idx = req.milestone_index
        if 0 <= idx < len(proj["milestones"]):
            proj["milestones"][idx]["completed"] = req.completed
            # Auto-advance phase based on milestone completion
            completed_counts = sum(1 for m in proj["milestones"] if m["completed"])
            phases = ["Planning", "Design", "Coding", "Testing", "Submission"]
            phase_idx = min(completed_counts, len(phases) - 1)
            proj["phase"] = phases[phase_idx]
            
            project_mentor_manager.save_project(req.workspace_id, req.project_id, proj)
            return {"ok": True, "project_data": proj}
        else:
            raise HTTPException(status_code=400, detail="Invalid milestone index.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/research/dynamic")
def dynamic_research(req: DynamicResearchRequest):
    """Performs dynamically Synthesized Search across duckduckgo."""
    try:
        return research_manager.perform_dynamic_research(req.query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Serves the visual dashboard single page app
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    # Bind to port 8000
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

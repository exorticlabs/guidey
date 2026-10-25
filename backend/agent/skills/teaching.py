"""
Teaching skill — TutorManager and ProjectMentorManager.

TutorManager now uses the TaskExecutionEngine for proper agentic task
lifecycle management and SubjectContextResolver for soft algorithmic
subject filtering.
"""

import json
import asyncio
import uuid
import re
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

from config import WORKSPACES_DIR, get_safe_workspace_path, sanitize_identifier
from core.agent import ProjectMentorAgent
from core.prompt_manager import cached_run_llm
from core.state import StateManager, SessionState
from core.professor_agent import UnifiedProfessorAgent
from core.lesson_planner import LessonPlanner
from core.professor_prompt import is_conversational_message
from skills.curriculum import CurriculumManager


class TutorManager:
    """Manages Socratic tutor lessons with unified single-engine execution."""

    def __init__(self):
        self.curr_manager = CurriculumManager()
        self.state_manager = StateManager()
        self.lesson_planner = LessonPlanner()
        self.professor_agent = UnifiedProfessorAgent(state_manager=self.state_manager)
        self.turn_executor = TurnExecutor(self)

    # ── Profile & History Persistence ───────────────────

    def _get_profile_path(self, workspace_id: str, student_id: str) -> Path:
        ws_dir = get_safe_workspace_path(workspace_id, student_id)
        return ws_dir / "profile.json"

    def _get_history_path(self, workspace_id: str, student_id: str, topic_id: str) -> Path:
        ws_dir = get_safe_workspace_path(workspace_id, student_id)
        hist_dir = ws_dir / "tutor_history"
        hist_dir.mkdir(parents=True, exist_ok=True)
        safe_topic = sanitize_identifier(topic_id, "default_topic")
        return hist_dir / f"chat_{safe_topic}.json"

    def load_student_profile(self, workspace_id: str, student_id: str) -> Dict[str, Any]:
        """Loads or creates a student profile containing mastery, learning style, and mistakes."""
        path = self._get_profile_path(workspace_id, student_id)
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass

        # Default profile if not found
        return {
            "student_id": student_id,
            "mastery": {},
            "learning_style": "visual",
            "study_time_seconds": 0,
            "interests": [],
            "weak_concepts": [],
            "mistakes": [],
        }

    def save_student_profile(self, workspace_id: str, student_id: str, profile: Dict[str, Any]):
        """Saves the student profile."""
        path = self._get_profile_path(workspace_id, student_id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(profile, f, indent=2, ensure_ascii=True)

        # Sync mastery to PostgreSQL database
        try:
            import sys
            import os
            from pathlib import Path
            backend_dir = Path(__file__).parent.parent.parent.parent / "backend"
            if str(backend_dir) not in sys.path:
                sys.path.append(str(backend_dir))

            from database import SessionLocal, update_user_overall_progress
            from models import Topic, UserTopicMapping

            db = SessionLocal()
            for topic_id_str, mastery_val in profile.get("mastery", {}).items():
                if str(topic_id_str).isdigit():
                    t_id = int(topic_id_str)
                    topic = db.query(Topic).filter(Topic.id == t_id).first()
                    if topic:
                        mapping = db.query(UserTopicMapping).filter(
                            UserTopicMapping.user_id == student_id,
                            UserTopicMapping.topic_id == t_id
                        ).first()
                        if not mapping:
                            mapping = UserTopicMapping(
                                user_id=student_id,
                                topic_id=t_id
                            )
                            db.add(mapping)
                        mapping.mastery_level = float(mastery_val)
                        if float(mastery_val) >= 70:
                            mapping.status = "completed"
                        elif float(mastery_val) > 0 and mapping.status == "locked":
                            mapping.status = "active"
            db.flush()
            update_user_overall_progress(db, student_id)
            db.close()
        except Exception as e:
            print(f"Failed to sync with PostgreSQL DB: {e}")

    def load_chat_history(self, workspace_id: str, student_id: str, topic_id: str) -> List[Dict[str, str]]:
        """Loads tutor chat history for a given topic."""
        path = self._get_history_path(workspace_id, student_id, topic_id)
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return []

    def save_chat_history(self, workspace_id: str, student_id: str, topic_id: str, history: List[Dict[str, str]]):
        """Saves tutor chat history."""
        path = self._get_history_path(workspace_id, student_id, topic_id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2, ensure_ascii=True)

    # ── Main Tutor Response (Unified Professor Single-Pass) ─────────

    def get_tutor_response(
        self,
        workspace_id: str,
        student_id: str,
        topic_id: str,
        student_message: str,
        category: str = "subject",
        subject_name: str = None,
        session_id: str = None,
        location: str = "general_chat",
        preferences: Dict[str, Any] = None,
        action: str = None,
        history: List[Dict[str, str]] = None,
        is_big_topic_guest: bool = False,
        agenda_guest: List[str] = None,
        current_index_guest: int = 0,
        db: Any = None,
    ) -> Dict[str, Any]:
        """
        Unified Professor Tutor Response Generation for HTTP endpoints.
        Delegates turn execution directly to TurnExecutor.execute_step_sync to eliminate divergence.
        """
        profile = self.load_student_profile(workspace_id, student_id)
        active_topic_id = topic_id
        active_topic_name = subject_name or ("General Discussion" if category != "topic" else topic_id)

        # ── Step 0: DB State Loading ────────────────────────────────
        is_big_topic = is_big_topic_guest
        agenda = agenda_guest
        current_index = current_index_guest
        topic_name_from_db = None

        if student_id != "guest":
            try:
                import sys
                from pathlib import Path
                backend_dir = Path(__file__).parent.parent.parent.parent / "backend"
                if str(backend_dir) not in sys.path:
                    sys.path.append(str(backend_dir))

                from database import SessionLocal
                from models import ChatSession, Topic

                if db is None:
                    db = SessionLocal()

                # Fetch actual topic name
                if topic_id and str(topic_id).isdigit():
                    db_topic = db.query(Topic).filter(Topic.id == int(topic_id)).first()
                    if db_topic:
                        topic_name_from_db = db_topic.name

                # Load session state
                if session_id and str(session_id).isdigit():
                    session_obj = db.query(ChatSession).filter(
                        ChatSession.id == int(session_id)
                    ).first()
                    if session_obj:
                        is_big_topic = session_obj.is_big_topic
                        if session_obj.agenda:
                            agenda = json.loads(session_obj.agenda)
                        current_index = session_obj.current_index

            except Exception as e:
                logger.error(f"Error loading session state: {e}")

        active_topic_name = topic_name_from_db or subject_name or (
            "General Discussion" if category != "topic" else topic_id
        )

        profile_context = dict(profile)
        profile_context["topic"] = active_topic_name
        profile_context["subject"] = subject_name or ("General" if category != "topic" else active_topic_name)

        sess_key = str(session_id) if session_id else f"sess_{student_id}_{active_topic_id}"
        history_key = str(session_id) if session_id else active_topic_id

        current_history = list(history) if history is not None else []
        if student_id != "guest" and history is None:
            current_history = self.load_chat_history(workspace_id, student_id, history_key)

        is_conversational = is_conversational_message(student_message)
        safety_max_steps = 1 if is_conversational else 10
        step_i = 0
        last_step_res: Optional[StepResult] = None

        while step_i < safety_max_steps:
            msg_for_step = student_message if step_i == 0 else None
            step_res = self.turn_executor.execute_step_sync(
                session_id=sess_key,
                workspace_id=workspace_id,
                student_id=student_id,
                user_message=msg_for_step,
                step_index=step_i,
                history=current_history,
                profile=profile_context,
                preferences=preferences,
            )
            last_step_res = step_res
            current_history = step_res.updated_history

            if is_conversational or step_res.yield_decision in ["ask", "yield"]:
                break
            step_i += 1

        payload = last_step_res.payload if last_step_res else {}
        board = payload.get("board", {})
        intent = payload.get("intent", {})
        voice = payload.get("voice", {})
        model = payload.get("model", {"gesture": "explain", "animations": []})

        return {
            "response": last_step_res.chat_markdown if last_step_res else "",
            "board": board,
            "intent": intent,
            "voice": voice,
            "model": model,
            "diverted": False,
            "active_topic_id": active_topic_id,
            "active_topic_name": active_topic_name,
            "is_big_topic": is_big_topic,
            "agenda": agenda,
            "current_index": current_index,
            "plan": payload.get("plan"),
            "requires_action": [],
        }

    # ── Helper Methods ──────────────────────────────────────────────

    def _build_student_state(self, profile: Dict[str, Any], topic_id: str) -> Dict[str, Any]:
        """Build a student state context dict for injection into prompts."""
        mastery = profile.get("mastery", {})
        topic_mastery = mastery.get(str(topic_id), 0)

        misconceptions = []
        for mistake in profile.get("mistakes", [])[-10:]:
            mc = mistake.get("misconception", "")
            if mc and mc not in misconceptions:
                misconceptions.append(mc)

        return {
            "mastery_score": topic_mastery,
            "misconceptions": misconceptions,
            "pace": profile.get("pace_signal"),
            "last_quiz_result": profile.get("last_quiz_result"),
        }

    def _extract_board_summary(self, history: List[Dict[str, str]]) -> Optional[str]:
        """Extract a brief summary of the current board state from recent history."""
        if not history:
            return None

        for msg in reversed(history):
            if msg.get("role") == "assistant":
                content = msg.get("content", "")
                if len(content) > 20:
                    return content[:200] + ("..." if len(content) > 200 else "")
        return None

    def _apply_student_state_update(
        self, profile: Dict[str, Any], topic_id: str,
        update: Dict[str, Any], workspace_id: str, student_id: str,
    ):
        """Apply student state updates from the LLM's update_student_state tool call."""
        try:
            mastery = profile.setdefault("mastery", {})
            topic_key = str(topic_id)
            current = mastery.get(topic_key, 0)
            delta = update.get("mastery_delta", 0)
            mastery[topic_key] = max(0, min(100, current + delta))

            misconception = update.get("misconception")
            if misconception:
                mistakes = profile.setdefault("mistakes", [])
                mistakes.append({
                    "topic_id": topic_key,
                    "misconception": misconception,
                })
                profile["mistakes"] = mistakes[-50:]

                weak = profile.setdefault("weak_concepts", [])
                if topic_key not in weak:
                    weak.append(topic_key)

            pace = update.get("pace")
            if pace:
                profile["pace_signal"] = pace

            if student_id != "guest":
                self.save_student_profile(workspace_id, student_id, profile)
        except Exception as e:
            print(f"Error applying student state update: {e}")


@dataclass
class StepResult:
    payload: Dict[str, Any]
    yield_decision: str  # "continue" | "yield" | "ask"
    ask_question: Optional[str] = None
    updated_history: List[Dict[str, str]] = None
    chat_markdown: str = ""
    step_index: int = 0
    voice_payload: Optional[Dict[str, Any]] = None



class TurnExecutor:
    """
    Event-driven turn executor powered by UnifiedProfessorAgent.
    Executes exactly ONE teaching step per call.
    Returns a StepResult indicating whether the agent wants to continue
    or yield control to the student.
    
    The CALLER (WebSocket handler / server endpoint) decides when to call execute_step() again,
    based on frontend acknowledgment signals.
    """
    
    MAX_STEPS_PER_TURN = 50  # Generous failsafe runaway ceiling allowing full curricula (10-15+ modules)
    
    def __init__(self, tutor_manager: 'TutorManager'):
        self.tutor = tutor_manager
        self.state_manager = tutor_manager.state_manager
        self.professor_agent = tutor_manager.professor_agent

    def _clean_history(self, history: List[Dict[str, str]]) -> List[Dict[str, str]]:
        clean = []
        for msg in (history or []):
            content = msg.get("content", "")
            if msg.get("role") in ["assistant", "ai"] and "```component" in content:
                content = re.sub(r'```component[\s\S]*?```', '', content).strip()
            if content:
                clean.append({"role": "assistant" if msg.get("role") in ["assistant", "ai"] else "user", "content": content})
        return clean

    def execute_step_sync(
        self,
        session_id: str,
        workspace_id: str,
        student_id: str,
        user_message: Optional[str],  # None = agent-initiated continuation
        step_index: int,
        history: List[Dict[str, str]],
        profile: Dict[str, Any],
        preferences: Optional[Dict[str, Any]] = None,
    ) -> StepResult:
        """
        Execute exactly ONE teaching step using UnifiedProfessorAgent synchronously.
        This is the single canonical execution engine for both HTTP and WebSocket loops.
        """
        sess_key = self.state_manager.build_scoped_session_id(
            session_id=str(session_id),
            workspace_id=workspace_id,
            student_id=student_id
        )
        topic_name = profile.get("topic") or "General"
        subject_name = profile.get("subject") or "General"

        state = self.state_manager.load_or_create_session(
            session_id=sess_key,
            subject=subject_name,
            topic=topic_name,
            workspace_id=workspace_id,
            student_id=student_id
        )

        is_conv = is_conversational_message(user_message)
        if user_message:
            cleaned_msg = user_message.strip()
            state.add_event("student", "message", cleaned_msg)
            # Only set/update state.topic on Step 0 (starting new topic) or if empty, and NOT conversational
            if not is_conv and (step_index == 0 or not state.topic or state.topic.lower() in ["general", "general concepts"]):
                topic_cleaned = re.sub(r"^(?:explain|what is|teach me about|teach me|tell me about|dive into|let's learn about|let's learn)\s+", "", cleaned_msg, flags=re.IGNORECASE).strip()
                if topic_cleaned:
                    state.topic = topic_cleaned.title() if len(topic_cleaned) <= 15 else topic_cleaned
            if len(state.nodes) > 8:
                state.nodes = state.nodes[-4:]
                state.overlays = []
                state.connections = []

        # ── Upfront Lesson Planning & Guidance ───────────────────
        if not state.plan and step_index == 0 and not is_conv:
            try:
                plan = self.tutor.lesson_planner.generate_lesson_plan(
                    topic=state.topic,
                    subject=state.subject,
                    student_query=user_message
                )
                state.set_plan(plan)
                self.state_manager.save(state)
            except Exception as e:
                logger.warning(f"Failed to generate lesson plan: {e}")

        plan_guidance = state.get_plan_summary()
        step_result = self.professor_agent.run_turn_step(
            state=state,
            student_message=user_message,
            step_index=step_index,
            guidance=plan_guidance,
            history=self._clean_history(history)
        )

        if step_result:
            self.professor_agent.apply_step_to_state(state, step_result, step_index=step_index)
            if not is_conv:
                state.advance_plan()
            self.state_manager.save(state)
            self.state_manager.save_step(
                session_id=sess_key,
                step_index=step_index,
                board_action=step_result.board_writes,
                speech=step_result.speech,
                gesture=step_result.gesture,
                yield_dec=step_result.yield_decision
            )

        speech_text = step_result.speech.strip() if step_result and step_result.speech else ""
        yield_dec = step_result.yield_decision if step_result else "yield"
        ask_q = step_result.question if step_result else None

        norm_yield = "continue"
        if yield_dec in ["ask_student", "ask"]:
            norm_yield = "ask"
            if not ask_q:
                ask_q = speech_text
            elif ask_q not in speech_text:
                speech_text = f"{speech_text} {ask_q}".strip()
        elif yield_dec in ["wait_for_input", "yield"]:
            norm_yield = "yield"

        # Check if lesson plan has remaining subtopics
        subtopics = state.plan.get("subtopics", []) if state.plan else []
        if state.plan and subtopics:
            has_more_plan = len(subtopics) > (state.plan_current_index + 1)
            # While lesson plan has more stages remaining, do not prematurely yield as 'done'
            if norm_yield == "yield" and not ask_q and has_more_plan:
                norm_yield = "continue"
        else:
            # Fallback without plan: continue if early in substantive query
            if norm_yield == "yield" and not ask_q and step_index < 2 and bool(user_message and len(user_message.split()) >= 3):
                norm_yield = "continue"

        if step_index >= self.MAX_STEPS_PER_TURN and norm_yield != "ask":
            norm_yield = "yield"

        # Split speech into individual natural sentences for synchronized chalk drawing
        raw_sentences = [s.strip() for s in re.split(r'(?<=[.?!])\s+', speech_text) if s.strip()]
        if not raw_sentences and speech_text:
            raw_sentences = [speech_text]

        new_nodes = [node for node in state.nodes if node.step_num == step_index]
        if not new_nodes:
            num_writes = len(step_result.board_writes) if step_result else 1
            new_nodes = state.nodes[-num_writes:] if state.nodes else []

        num_new = len(new_nodes)
        num_sentences = max(1, len(raw_sentences))

        # Convert state.nodes to elements for whiteboard frontend
        elements = []
        y_cursor = 10.0
        for node in state.nodes:
            el = {
                "id": node.id,
                "type": node.kind if node.kind in ["text", "equation", "heading", "concept_node", "scratchpad", "step", "diagram", "scatter", "topic", "subtopic", "definition", "bullet_list", "table", "flowchart", "code"] else "text",
                "kind": node.kind,
                "role": node.role or "primary_stream",
                "content": node.content,
                "x": 10.0 if node.zone in ["main", "primary"] else 65.0,
                "y": min(85.0, y_cursor),
                "w": node.w,
                "h": node.h,
                "step_num": node.step_num if node.step_num is not None else step_index,
                "zone_id": node.zone,
                "spatial_intent": node.spatial_intent,
            }
            if node not in new_nodes:
                el["appear_at"] = 0
            else:
                new_idx = new_nodes.index(node)
                assigned_idx = min(num_sentences - 1, int((new_idx / max(1, num_new)) * num_sentences))
                el["appear_at"] = assigned_idx

            elements.append(el)
            y_cursor += 16.0

        chalk_overlays = [
            {
                "id": ov.id,
                "target_node_id": ov.target_node_id,
                "overlay_type": ov.overlay_type,
                "sub_term": ov.sub_term,
                "color": ov.color,
                "annotation_text": ""
            }
            for ov in state.overlays
        ]

        board_payload = {
            "elements": elements,
            "chalk_overlays": chalk_overlays,
            "connections": [asdict(c) for c in state.connections],
            "canvas_w": state.canvas_w,
            "canvas_h": state.canvas_h
        }

        speech_seq = []
        for s_idx, sentence in enumerate(raw_sentences):
            sync_target_id = None
            for el in elements:
                if el.get("appear_at") == s_idx and (not new_nodes or any(n.id == el["id"] for n in new_nodes)):
                    sync_target_id = el["id"]
                    break

            speech_seq.append({
                "text": sentence,
                "sync_with": sync_target_id
            })

        anim_cycle = ["explain", "point_board", "think", "encourage"]
        model_payload = {
            "gesture": step_result.gesture if step_result else "explain",
            "animations": [
                {
                    "animation": anim_cycle[idx % len(anim_cycle)],
                    "sync_with_speech_index": idx
                }
                for idx in range(len(raw_sentences))
            ]
        }

        voice_payload = {
            "speech_sequence": speech_seq,
            "gesture": step_result.gesture if step_result else "explain"
        }

        combined_payload = {
            "type": "OrchestratedTeachStep",
            "step_index": step_index,
            "intent": {
                "socratic_check": ask_q,
                "yield": norm_yield
            },
            "board": board_payload,
            "voice": voice_payload,
            "model": model_payload
        }
        if norm_yield == "ask" and ask_q:
            combined_payload["ask"] = ask_q
        if state.plan:
            combined_payload["plan"] = state.plan

        comp_markdown = f"\n\n```component\n{json.dumps(combined_payload)}\n```"
        chat_markdown = f"{speech_text}{comp_markdown}" if speech_text else comp_markdown

        new_history = list(history or [])
        new_history.append({"role": "assistant", "content": chat_markdown})
        if student_id != "guest":
            self.tutor.save_chat_history(workspace_id, student_id, str(session_id), new_history)

        return StepResult(
            payload=combined_payload,
            yield_decision=norm_yield,
            ask_question=ask_q,
            updated_history=new_history,
            chat_markdown=chat_markdown,
            step_index=step_index,
            voice_payload=voice_payload,
        )

    async def execute_step(
        self,
        session_id: str,
        workspace_id: str,
        student_id: str,
        user_message: Optional[str],  # None = agent-initiated continuation
        step_index: int,
        history: List[Dict[str, str]],
        profile: Dict[str, Any],
        preferences: Optional[Dict[str, Any]] = None,
    ) -> StepResult:
        """
        Execute exactly ONE teaching step using UnifiedProfessorAgent asynchronously.
        Delegates to execute_step_sync via asyncio.to_thread for non-blocking concurrency.
        """
        return await asyncio.to_thread(
            self.execute_step_sync,
            session_id=session_id,
            workspace_id=workspace_id,
            student_id=student_id,
            user_message=user_message,
            step_index=step_index,
            history=history,
            profile=profile,
            preferences=preferences,
        )

    async def run_teaching_loop(self, workspace_id: str, student_id: str, session_id: str, initial_message: str, websocket: Any, turn_id: str = None, board_enabled: bool = True, signal_queue: Any = None):
        """Deprecated compatibility method that executes one step."""
        profile = self.tutor.load_student_profile(workspace_id, student_id)
        history = self.tutor.load_chat_history(workspace_id, student_id, str(session_id))
        step_res = await self.execute_step(
            session_id=session_id,
            workspace_id=workspace_id,
            student_id=student_id,
            user_message=initial_message,
            step_index=0,
            history=history,
            profile=profile
        )
        await websocket.send_json({
            "type": "chat",
            "turn_id": turn_id,
            "data": {"role": "ai", "content": step_res.chat_markdown}
        })
        if step_res.voice_payload:
            await websocket.send_json({
                "type": "voice",
                "turn_id": turn_id,
                "data": step_res.voice_payload
            })
        if step_res.yield_decision == "ask":
            await websocket.send_json({"type": "ask", "turn_id": turn_id, "question": step_res.ask_question})
        await websocket.send_json({"type": "status", "turn_id": turn_id, "data": "teaching_finished"})
                
# ── Project Mentor Manager (unchanged) ──────────────────────────────────

class ProjectMentorManager:
    """Manages student software/coding projects step-by-step using ProjectMentorAgent."""

    def __init__(self):
        self.agent = ProjectMentorAgent()

    def _get_project_path(self, workspace_id: str, student_id: str, project_id: str) -> Path:
        proj_dir = get_safe_workspace_path(workspace_id, student_id) / "projects"
        proj_dir.mkdir(parents=True, exist_ok=True)
        safe_proj = sanitize_identifier(project_id, "default_proj")
        return proj_dir / f"project_{safe_proj}.json"

    def load_project(self, workspace_id: str, student_id: str, project_id: str) -> Dict[str, Any]:
        """Loads a project state or initializes a new one."""
        path = self._get_project_path(workspace_id, student_id, project_id)
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass

        return {
            "project_id": project_id,
            "title": project_id.replace("_", " ").title(),
            "phase": "Planning",
            "milestones": [
                {"name": "Define requirements & features", "completed": False},
                {"name": "Design system architecture & data flow", "completed": False},
                {"name": "Implement core code logic", "completed": False},
                {"name": "Write unit tests & debug edge cases", "completed": False},
                {"name": "Prepare project documentation & final submit", "completed": False},
            ],
            "notes": "",
            "history": [],
        }

    def save_project(self, workspace_id: str, student_id: str, project_id: str, project_data: Dict[str, Any]):
        """Saves project progress and history."""
        path = self._get_project_path(workspace_id, student_id, project_id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(project_data, f, indent=2, ensure_ascii=True)

    def get_mentor_response(self, workspace_id: str, student_id: str, project_id: str, student_message: str) -> Dict[str, Any]:
        """Runs the project mentor agent to guide the student, updating history."""
        proj = self.load_project(workspace_id, student_id, project_id)
        history = proj.get("history", [])

        history.append({"role": "user", "content": student_message})

        prompt = f"Project Requirements:\n{proj}\nPlease mentor the student on this project."

        response_content = self.agent.run(prompt, history=history)
        history.append({"role": "assistant", "content": response_content})

        proj["history"] = history
        self.save_project(workspace_id, student_id, project_id, proj)

        return {
            "response": response_content,
            "project_data": proj,
        }

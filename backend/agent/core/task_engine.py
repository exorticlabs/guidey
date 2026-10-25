"""
Task Execution Engine — Agentic task system for guiedteach.

Manages the lifecycle of teaching tasks with proper state machine logic,
execution pipeline (pre/execute/post), and working memory with LLM
summarization. Integrates with the existing persistent MemoryManager.
"""

import copy
import hashlib
import json
import logging
import threading
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("task_engine")
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    logger.addHandler(ch)

from .utils import now_iso


# ── Enums ───────────────────────────────────────────────────────────────

class TaskType(str, Enum):
    TEACH_TOPIC = "teach_topic"
    ANSWER_QUESTION = "answer_question"
    QUIZ = "quiz"
    FREE_CHAT = "free_chat"
    SUBJECT_OVERVIEW = "subject_overview"




# ── Data Classes ────────────────────────────────────────────────────────

@dataclass
class TaskContext:
    """Tracks what the agent is currently doing."""
    task_id: str
    task_type: TaskType = TaskType.FREE_CHAT
    current_working_state: str = "initializing"
    objective: str = ""
    subject_context: Dict[str, Any] = field(default_factory=dict)
    progress: Dict[str, Any] = field(default_factory=lambda: {
        "steps_completed": 0,
        "total_steps": 0,
        "concepts_covered": [],
    })
    parent_task_id: Optional[str] = None  # For child tasks (e.g., question mid-lesson)
    created_at: str = ""
    last_active: str = ""

    def __post_init__(self):
        if not self.created_at:
            self.created_at = now_iso()
        if not self.last_active:
            self.last_active = now_iso()

    def to_dict(self) -> dict:
        d = asdict(self)
        d["task_type"] = self.task_type.value
        d["current_working_state"] = self.current_working_state
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "TaskContext":
        d = dict(d)
        d["task_type"] = TaskType(d.get("task_type", "free_chat"))
        d["current_working_state"] = d.get("current_working_state", "initializing")
        return cls(**d)


@dataclass
class PreparedContext:
    """Output of pre_execute — everything needed for the LLM call."""
    messages: List[Dict[str, str]]
    task_ctx: TaskContext
    resolved_subject: Optional[Any] = None  # ResolvedContext from subject_filter
    tools: Optional[List[dict]] = None


# ── Task Memory (Structured) ────────────────────────────────────────────

TASK_MEMORY_DIR = Path(__file__).parent.parent / "memory" / "task_memory"

_task_memory_locks = {}
_task_memory_global_lock = threading.Lock()

class TaskMemoryManager:
    """
    Manages the structured Task Memory state (previously Blackboard) for 
    the multi-agent orchestrator loop. Thread-safe for concurrent agent writes.
    """
    def __init__(self):
        pass

    def _get_lock(self, session_id: str):
        with _task_memory_global_lock:
            if session_id not in _task_memory_locks:
                _task_memory_locks[session_id] = threading.Lock()
            return _task_memory_locks[session_id]

    def _session_dir(self, session_id: str) -> Path:
        d = TASK_MEMORY_DIR / str(session_id)
        d.mkdir(parents=True, exist_ok=True)
        return d

    def load_memory(self, session_id: str) -> dict:
        """Loads the structured task memory for the session."""
        with self._get_lock(session_id):
            path = self._session_dir(session_id) / "task_memory.json"
            if path.exists():
                try:
                    return json.loads(path.read_text(encoding="utf-8"))
                except Exception:
                    pass
        
        # Default structured task memory (merged with TaskContext)
        return {
            "session_id": session_id,
            "task_type": "free_chat",
            "current_working_state": "initializing",
            "objective": "",
            "progress": {
                "steps_completed": 0,
                "total_steps": 0,
                "concepts_covered": []
            },
            "parent_task_id": None,
            "current_topic": "General",
            "board_state": [],
            "voice_queue": [],
            "recent_events": [],
            "user_profile": {
                "learning_style": "visual",
                "weak_concepts": [],
                "interests": [],
                "mastery_updates": {}
            },
            "pedagogical_intent": {}
        }

    def save_memory(self, session_id: str, memory_data: dict):
        """Persists the structured task memory."""
        with self._get_lock(session_id):
            path = self._session_dir(session_id) / "task_memory.json"
            try:
                path.write_text(json.dumps(memory_data, indent=2, ensure_ascii=True), encoding="utf-8")
            except Exception as e:
                print(f"[TaskMemoryManager] Error saving task memory: {e}")
            
    def append_event(self, session_id: str, actor: str = None, action: str = None, data: Any = None, target: str = None, event: Any = None):
        """Appends an event to recent_events in the task memory."""
        import time
        if event is None:
            event = {
                "id": f"evt_{hashlib.md5(str(time.time()).encode()).hexdigest()[:6]}",
                "timestamp": now_iso(),
                "actor": actor,
                "action": action,
                "data": data,
                "target": target
            }
            
        with self._get_lock(session_id):
            path = self._session_dir(session_id) / "task_memory.json"
            
            mem = self.load_memory(session_id)
            
            mem["recent_events"].append(event)
            # Keep only the last 30 events to prevent massive context growth
            mem["recent_events"] = mem["recent_events"][-30:]
            
            logger.info(f"Memory Event [{session_id}]: Actor={actor}, Action={action}, Target={target}, Data={data}")
            
            try:
                path.write_text(json.dumps(mem, indent=2, ensure_ascii=True), encoding="utf-8")
            except Exception as e:
                logger.error(f"[TaskMemoryManager] Error saving task memory: {e}")
                print(f"[TaskMemoryManager] Error saving task memory: {e}")

    def get_memory_prompt_block(self, session_id: str) -> str:
        """Returns softened background task context without aggressive preference injection."""
        mem = self.load_memory(session_id)
        uprof = mem.get("user_profile", {})
        style = uprof.get("learning_style", "conversational")
        weak = uprof.get("weak_concepts", [])

        lines = ["[BACKGROUND LEARNER CONTEXT (Auxiliary Guidance)]:"]
        lines.append(f"- Preferred Pace / Explanation Style: {style}")
        if weak:
            # Only include recent weak concepts for pedagogical scaffolding
            lines.append(f"- Known Conceptual Hurdles: {', '.join(weak[-3:])}")
        lines.append("- Guidance: Teach the current topic directly. Do not assume previous subjects are personal preferences.")
        return "\n".join(lines) + "\n"



# ── Task Execution Engine ───────────────────────────────────────────────

TASK_STATE_DIR = Path(__file__).parent.parent / "memory" / "task_states"


class TaskExecutionEngine:
    """
    Agentic task execution engine with state machine, execution pipeline,
    and working memory. Integrates with the existing MemoryManager for
    persistent storage.

    Usage:
        engine = TaskExecutionEngine()
        task_ctx = engine.load_or_create_task(session_id, TaskType.TEACH_TOPIC, "Bubble Sort")
        prepared = engine.pre_execute(task_ctx, user_message, full_history, db)
        llm_response = engine.execute(prepared)
        result = engine.post_execute(task_ctx, llm_response, session_id)
    """

    def __init__(self):
        self.memory_manager = TaskMemoryManager()

    # ── Task Lifecycle ──────────────────────────────────────────────

    def load_or_create_task(
        self,
        session_id: str,
        task_type: TaskType = TaskType.FREE_CHAT,
        objective: str = "",
    ) -> TaskContext:
        """Load an existing task context or create a new one."""
        existing = self._load_task_state(session_id)
        if existing:
            existing.last_active = now_iso()
            return existing

        ctx = TaskContext(
            task_id=session_id,
            task_type=task_type,
            phase=TaskPhase.INIT,
            objective=objective,
        )
        self._save_task_state(session_id, ctx)
        return ctx

    def pre_execute(
        self,
        task_ctx: TaskContext,
        user_message: str,
        full_history: List[Dict[str, str]],
        system_prompt: str,
        tools: Optional[List[dict]] = None,
        resolved_subject: Optional[Any] = None,
    ) -> PreparedContext:
        """
        Phase 1: Context resolution.
        - Load working memory (windowed history + summary)
        - Detect if task type needs to change
        - Build the messages array with cache breakpoints
        """
        # Detect task type transitions from user message
        new_type = self._detect_task_transition(task_ctx, user_message)
        if new_type and new_type != task_ctx.task_type:
            # If switching from TEACH to ANSWER_QUESTION, save parent
            if (task_ctx.task_type == TaskType.TEACH_TOPIC
                    and new_type == TaskType.ANSWER_QUESTION):
                task_ctx.parent_task_id = task_ctx.task_id
            task_ctx.task_type = new_type

        # Load task memory state
        task_memory_block = self.memory_manager.get_memory_prompt_block(
            task_ctx.task_id
        )

        # No scratchpad anymore, replaced by TaskMemory
        scratchpad_block = ""

        # Build messages array
        messages = []

        # 1. System prompt
        full_system = system_prompt
        if task_memory_block:
            full_system += f"\n\n{task_memory_block}"

        messages.append({"role": "system", "content": full_system})

        # 2. History (We use full_history but trimmed to last 15 messages so it doesn't overflow)
        recent_history = full_history[-15:] if full_history else []
        for msg in recent_history:
            messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", ""),
            })

        # 3. Current user message
        messages.append({"role": "user", "content": user_message})

        # Apply cache breakpoints
        messages = inject_cache_breakpoints(messages)



        return PreparedContext(
            messages=messages,
            task_ctx=task_ctx,
            resolved_subject=resolved_subject,
            tools=tools,
        )

    def execute(self, prepared: PreparedContext) -> Any:

        result = {
            "content": "",
            "tool_calls": [],
            "teach_step": None,
            "student_state_update": None,
        }

        if isinstance(llm_response, str):
            result["content"] = llm_response
        elif isinstance(llm_response, dict):
            result["content"] = llm_response.get("content", "")
            result["tool_calls"] = llm_response.get("tool_calls", [])

        # Process tool calls → update scratchpad
        for tc in result["tool_calls"]:
            fn = tc.get("function", {})
            name = fn.get("name", "")
            try:
                args = fn.get("arguments", "{}")
                if isinstance(args, str):
                    args = json.loads(args)
                elif not isinstance(args, dict):
                    args = {}

                if name == "teach_step":
                    result["teach_step"] = {
                        "step_title": args.get("step_title"),
                        "speech": args.get("speech", ""),
                        "visuals": args.get("visuals", []),
                        "interaction": args.get("interaction", {}),
                    }
                    # Track covered concepts
                    title = args.get("step_title", "")
                    if title:
                        self.working_memory.append_scratchpad(
                            session_id, "concepts_covered", title
                        )
                    # Track if quiz was included
                    interaction = args.get("interaction", {})
                    if interaction.get("type") == "quiz":
                        self.working_memory.update_scratchpad(
                            session_id, "last_quiz_question",
                            interaction.get("question", ""),
                        )

                elif name == "update_student_state":
                    result["student_state_update"] = {
                        "mastery_delta": args.get("mastery_delta", 0),
                        "misconception": args.get("misconception"),
                        "pace": args.get("pace"),
                        "objective_complete": args.get("objective_complete", False),
                    }
                    # Record findings in scratchpad
                    misconception = args.get("misconception")
                    if misconception:
                        self.working_memory.append_scratchpad(
                            session_id, "misconceptions_found", misconception
                        )
                    if args.get("objective_complete"):
                        task_ctx.progress["steps_completed"] = (
                            task_ctx.progress.get("steps_completed", 0) + 1
                        )
                        # Check if all steps done
                        total = task_ctx.progress.get("total_steps", 0)
                        if total and task_ctx.progress["steps_completed"] >= total:
                            task_ctx.current_working_state = "completed"

            except Exception as e:
                print(f"[TaskEngine] Tool processing error: {e}")

        # Persist task state
        self._save_task_state(session_id, task_ctx)

        return result

    # ── Task Transition Detection ───────────────────────────────────

    def _detect_task_transition(
        self, task_ctx: TaskContext, user_message: str
    ) -> Optional[TaskType]:
        """
        Detect if the user's message implies a task type change.
        Uses lightweight keyword heuristics for speed — the LLM classifier
        in teaching.py handles the heavier classification.
        """
        msg = user_message.strip().lower() if user_message else ""

        if task_ctx.task_type == TaskType.TEACH_TOPIC:
            # Mid-lesson question detection
            question_signals = ["?", "why ", "what ", "how ", "can you explain",
                                "i don't understand", "what does", "what is"]
            if any(sig in msg for sig in question_signals):
                # Only transition if it's clearly a question, not a quiz answer
                if not any(kw in msg for kw in ["option", "answer is", "i think it's"]):
                    return TaskType.ANSWER_QUESTION

            # Quiz request
            if any(kw in msg for kw in ["quiz me", "test me", "give me a quiz"]):
                return TaskType.QUIZ

        elif task_ctx.task_type == TaskType.ANSWER_QUESTION:
            # Return to parent task after answering
            if any(kw in msg for kw in ["continue", "next", "go on", "back to lesson",
                                         "ok", "got it", "thanks", "understood"]):
                if task_ctx.parent_task_id:
                    return TaskType.TEACH_TOPIC

        elif task_ctx.task_type == TaskType.QUIZ:
            # After quiz, return to teaching
            if any(kw in msg for kw in ["continue", "next concept", "explain"]):
                return TaskType.TEACH_TOPIC

        return None

    # ── Task State Persistence ──────────────────────────────────────

    def _load_task_state(self, session_id: str) -> Optional[TaskContext]:
        path = TASK_STATE_DIR / f"{session_id}.json"
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                return TaskContext.from_dict(data)
            except Exception as e:
                print(f"[TaskEngine] Error loading task state: {e}")
        return None

    def _save_task_state(self, session_id: str, ctx: TaskContext):
        TASK_STATE_DIR.mkdir(parents=True, exist_ok=True)
        path = TASK_STATE_DIR / f"{session_id}.json"
        try:
            path.write_text(
                json.dumps(ctx.to_dict(), indent=2, ensure_ascii=True),
                encoding="utf-8",
            )
        except Exception as e:
            print(f"[TaskEngine] Error saving task state: {e}")


# ── Cache Breakpoints ───────────────────────────────────────────────────

def inject_cache_breakpoints(
    messages: List[Dict[str, Any]],
    session_id: str = None,
    max_breakpoints: int = 4,
) -> List[Dict[str, Any]]:
    """
    Inject cache_control breakpoints into a messages array.

    Strategy:
      1. System prompt (index 0, if role=system). We inject session_id to isolate the cache.
      2. The first user message (usually the massive Environment Block).
    """
    if not messages:
        return messages

    # Work on a copy to avoid mutating the original
    result = [dict(m) for m in messages]
    breakpoint_indices = []

    # Breakpoint 1: System prompt
    if result[0].get("role") == "system":
        if session_id:
            # Inject session_id invisibly to strictly partition the cache by session
            result[0]["content"] = f"[Session Cache ID: {session_id}]\n" + result[0]["content"]
        breakpoint_indices.append(0)

    # Breakpoint 2: First non-system message (Environment Context)
    non_system_indices = [
        i for i, m in enumerate(result) if m.get("role") != "system"
    ]
    if non_system_indices:
        breakpoint_indices.append(non_system_indices[0])

    # Apply cache_control markers
    for idx in breakpoint_indices:
        result[idx]["cache_control"] = {"type": "ephemeral"}

    return result

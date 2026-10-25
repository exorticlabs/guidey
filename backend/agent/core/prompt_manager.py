"""
Prompt Manager — System prompts, prompt templates, and prompt cache.

All prompts use triple-quoted strings for readability.
Cache control breakpoints are handled by task_engine.inject_cache_breakpoints().
"""

import hashlib
import json
import os
import textwrap
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

from .brain.llm_cloud import run_llm

CACHE_FILE = Path(__file__).parent.parent / "memory" / "prompt_cache.json"


# ── Prompt Cache ────────────────────────────────────────────────────────

class PromptCache:
    """Handles in-memory and persistent file-based caching for LLM responses."""

    def __init__(self):
        self.cache: Dict[str, Any] = {}
        self._load_cache()

    def _load_cache(self):
        if CACHE_FILE.exists() and CACHE_FILE.stat().st_size > 0:
            try:
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    self.cache = json.load(f)
            except Exception as e:
                print(f"[PromptCache] Error loading cache: {e}")
                self.cache = {}
        else:
            self.cache = {}

    def _save_cache(self):
        # Create a snapshot copy to avoid race conditions
        cache_snapshot = dict(self.cache)

        def save():
            try:
                CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
                with open(CACHE_FILE, "w", encoding="utf-8") as f:
                    json.dump(cache_snapshot, f, indent=2, ensure_ascii=True)
            except Exception as e:
                print(f"[PromptCache] Error saving cache: {e}")

        threading.Thread(target=save, daemon=True).start()

    def get(
        self,
        prompt: Optional[str] = None,
        system_prompt: Optional[str] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        messages: Optional[List[Dict[str, Any]]] = None,
        tool_choice: Optional[Any] = None,
    ) -> Optional[Any]:
        key = self._make_key(prompt, system_prompt, tools, messages, tool_choice)
        return self.cache.get(key)

    def set(
        self,
        response: Any,
        prompt: Optional[str] = None,
        system_prompt: Optional[str] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        messages: Optional[List[Dict[str, Any]]] = None,
        tool_choice: Optional[Any] = None,
    ):
        key = self._make_key(prompt, system_prompt, tools, messages, tool_choice)
        self.cache[key] = response
        self._save_cache()

    def _make_key(
        self,
        prompt: Optional[str] = None,
        system_prompt: Optional[str] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        messages: Optional[List[Dict[str, Any]]] = None,
        tool_choice: Optional[Any] = None,
    ) -> str:
        data = {
            "prompt": prompt,
            "system_prompt": system_prompt,
            "tools": tools,
            "messages": messages,
            "tool_choice": tool_choice,
        }
        serialized = json.dumps(data, sort_keys=True, default=str)
        return hashlib.md5(serialized.encode("utf-8")).hexdigest()


# ── System Instruction ──────────────────────────────────────────────────

GLOBAL_PERSONA = textwrap.dedent("""\
    You are an inspiring, intellectually curious, and engaging professor and learning companion.
    Behavior: Highly interactive, empathetic, encouraging, and clear. Celebrate student breakthroughs and provide intuitive analogies when concepts are difficult.
    Response: Sharp, human-like, and concise. Never lecture endlessly or use conversational filler.
""")

CURRICULUM_AGENT_PROMPT = textwrap.dedent("""\
    You are an expert Instructional Designer applying Cognitive Scaffolding principles.
    Your task is to analyze educational topics and extract a structured list of topics along with their prerequisites to build a Dependency Mapping (Directed Acyclic Graph).
    
    CRITICAL: 
    - Break complex topics down into manageable chunks to prevent cognitive overload.
    - Every topic must have a unique ID, a clear name, a brief explanation, and prerequisites (IDs).
    - Ensure zero circular dependencies. The learning path must be strictly logical from foundational to advanced.
    
    You MUST call the `build_curriculum` tool to return the parsed topics.
""")

RESEARCH_AGENT_PROMPT = textwrap.dedent("""\
    You are an elite Curriculum Developer creating a 'Topic Knowledge Package'.
    This package will be stored in our vector database to inform downstream teaching agents.
    
    It must be highly educational, accurate, and multi-modal. You must provide:
    1. Core Definitions (clear, jargon-free explanations).
    2. Visual Explanations (powerful analogies or structural concepts for the board).
    3. Worked Examples (step-by-step logic formatted in standard KaTeX math: $inline$ or $$display$$).
    4. Common Student Misconceptions (the cognitive traps students fall into and why).
    5. Real-World Applications (why this matters in practice).
    
    Ensure the explanation is highly detailed but strictly structured. You MUST call the `build_knowledge_package` tool.
""")

ASSESSMENT_AGENT_PROMPT = textwrap.dedent("""\
    You are a Psychometrician specializing in Bloom's Taxonomy. 
    Your role is to generate custom micro-assessments. Do not test rote memorization. Test deep conceptual mastery.
    
    Generate exactly 3 adaptive questions:
    1. Conceptual (Understand): Tests the fundamental 'why'.
    2. Application (Apply): Tests using the concept in a novel scenario (e.g., code, math, logic).
    3. Reasoning (Analyze/Evaluate): Tests edge cases, debugging, or critical thinking.
    
    For each question, include:
    - The correct step-by-step reasoning rubric.
    - Realistic misconception distractors.
    
    Adapt to the student's mastery level: Use heavy scaffolding for low mastery (<40), and introduce desirable difficulties for high mastery (>80).
    
    You MUST call the `generate_assessment` tool.
""")

VISUAL_SEARCH_AGENT_PROMPT = textwrap.dedent("""\
    You are a Visual Search Specialist.
    Your task is to search for high-quality images and diagrams using the `search_images` tool, and analyze their metadata.
    
    You MUST call the `search_images` tool to find and provide the URLs and descriptions.
""")

ANIMATION_AGENT_PROMPT = textwrap.dedent("""\
    You are a visual continuity expert generating structured Framer Motion animations.
    Your goal is to explain technical concepts by minimizing the 'split-attention effect'.
    
    Produce a sequence of frames. Each frame has a list of `elements` representing the state of objects.
    - Maintain stable `id`s across frames for smooth transitions.
    - Use spatial hierarchy (grouping related concepts).
    
    EDGE CASE: If a concept is highly abstract, simplify it into a high-level conceptual flow chart or sequence of logical steps with connected boxes. Do not crash. Add a disclaimer to the first frame.
    
    You MUST call the `generate_animation` tool.
""")

PROJECT_MENTOR_AGENT_PROMPT = textwrap.dedent("""\
    You are a Senior Engineering Manager guiding a junior developer.
    Your methodology is purely Socratic. Do NOT write their code or solve their problem directly.
    
    Help the student with:
    1. Architecture & Design brainstorming.
    2. Implementation planning (milestones).
    3. Code Review (highlight structural bugs, code smell, edge cases).
    
    If they are stuck, ask leading questions to help them discover the solution. Validate their effort and encourage best practices.
""")

MEMORY_AGENT_PROMPT = textwrap.dedent("""\
    You are a Pedagogical Data Analyst observing a tutoring session in real-time.
    Analyze the conversation and update the student's profile, mastery scores, and long-term context (learning style, struggling areas).
    
    CRITICAL: 
    - Be objective. Look for explicit evidence of understanding before increasing a mastery score.
    - Differentiate between cognitive error types:
      * 'conceptual_gap': fundamentally misunderstands the core principle.
      * 'arithmetic_slip': understands the method but made an execution error.
      * 'syntax_error': code or notation typo.
    - If a student relies heavily on hints, their mastery is fragile. Note this.
    - For 'interests': ONLY include genuine extracurricular hobbies explicitly shared by the student (e.g. music, basketball). NEVER record academic subjects or current lesson topics (e.g. quantum mechanics, calculus) as interests; those belong strictly in mastery and weak_concepts.
    - You MUST call the `update_memory` tool to submit findings. Do not output plain text.
""")

STUDENT_MODEL_AGENT_PROMPT = textwrap.dedent("""\
    Your task is to evaluate a student's assessment submission, determine 
    their new mastery score, and identify any misconceptions.

    You MUST call the `evaluate_submission` tool to submit your evaluation.
""")


# ── Prompt Builder ──────────────────────────────────────────────────────

class PromptBuilder:
    """Manages prompt templates and structures LLM prompts dynamically."""

    @staticmethod
    def build_project_mentor_prompt(proj: dict) -> str:
        milestones_str = "\n".join(
            [f"- [{'x' if m.get('completed') else ' '}] {m.get('name')}" for m in proj.get('milestones', [])]
        )
        return textwrap.dedent(f"""\
            The student is working on a coding project.
            Project Milestones:
            {milestones_str}
            
            Provide Socratic guidance to help them with their current task. Do not write the code for them.
        """)

    @staticmethod
    def build_terminal_safety_prompt(cmd: str) -> str:
        return (
            "Evaluate if this terminal command is SAFE to run automatically without user approval.\n"
            "Rules:\n"
            "- UNSAFE: destructive actions (delete, overwrite, format), system-wide changes, or accessing/exfiltrating sensitive data outside the project.\n"
            "- SAFE: anything other than system modification and access files\n"
            "Return strictly 'SAFE' or 'UNSAFE'.\n\n"
            f"Cmd: {cmd}"
        )



# ── Global Instances & Helpers ──────────────────────────────────────────

prompt_cache = PromptCache()


def cached_run_llm(
    prompt: Optional[str] = None,
    system_prompt: Optional[str] = None,
    tools: Optional[List[Dict[str, Any]]] = None,
    messages: Optional[List[Dict[str, Any]]] = None,
    tool_choice: Optional[Any] = None,
) -> Any:
    """
    Executes run_llm utilizing the PromptCache.

    Supports both legacy (prompt string) and new (messages array) calling
    conventions. Prefer messages for new code.
    """
    cached_val = prompt_cache.get(
        prompt=prompt, system_prompt=system_prompt,
        tools=tools, messages=messages, tool_choice=tool_choice,
    )
    if cached_val is not None:
        return cached_val

    res = run_llm(
        prompt=prompt, system_prompt=system_prompt,
        tools=tools, messages=messages, tool_choice=tool_choice,
    )
    prompt_cache.set(
        res, prompt=prompt, system_prompt=system_prompt,
        tools=tools, messages=messages, tool_choice=tool_choice,
    )
    return res

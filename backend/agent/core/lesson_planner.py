"""
lesson_planner.py — Educational Lesson Planning & State-Tracked Curricular Sequencing.

Replaces static blueprints with an upfront dynamic LLM planning call that outlines:
1. Ordered subtopics to teach.
2. Conceptual goals for each step.
3. Essential definitions and formulae to introduce.
4. Chalkboard visual intents.
5. Real-time plan state tracking (pending, teaching, completed).
"""
import json
import logging
import time
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field, asdict

from agent.core.brain.llm_cloud import run_llm

logger = logging.getLogger("lesson_planner")


LESSON_PLAN_TOOL: Dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "create_lesson_plan",
        "description": "Classify the user prompt into an academic scope category and construct an appropriately sized, pedagogically sequenced lesson plan.",
        "parameters": {
            "type": "object",
            "properties": {
                "prompt_type": {
                    "type": "string",
                    "enum": ["conversational", "simple_doubt", "concept", "topic", "chapter_or_subject"],
                    "description": "Classification of user intent: 'conversational' (greetings/meta), 'simple_doubt' (quick targeted question), 'concept' (single focused formula/theorem/mechanism), 'topic' (standard modular unit), or 'chapter_or_subject' (broad multi-part field/chapter/course)."
                },
                "classification_rationale": {
                    "type": "string",
                    "description": "Brief 1-sentence reason for this classification and chosen stage count."
                },
                "topic": {
                    "type": "string",
                    "description": "Clean, canonical academic topic title (e.g. 'DBMS', 'Projectile Motion', 'Chain Rule')."
                },
                "pedagogical_goal": {
                    "type": "string",
                    "description": "Primary learning outcome the student will achieve."
                },
                "subtopics": {
                    "type": "array",
                    "description": "Ordered sequence of subtopics. For chapters or whole subjects, construct a complete multi-module curriculum with whatever number of stages is needed for full mastery (no artificial step limits; e.g. 8 to 15+ comprehensive modules for academic subjects). For concepts and topics, plan as many stages as genuinely required.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string", "description": "Unique identifier (e.g. step_1, step_2)"},
                            "title": {"type": "string", "description": "Short, clear title for this subtopic"},
                            "goal": {"type": "string", "description": "Specific concept, problem, or mechanism to address in this stage"},
                            "definitions": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Key terms, variables, or definitions to introduce"
                            },
                            "formulae": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Key math equations, formulas, or code snippets"
                            },
                            "format_strategy": {
                                "type": "string",
                                "enum": ["concept_and_bullets", "comparison_table", "process_flowchart", "formula_and_derivation", "worked_example", "socratic_synthesis"],
                                "description": "Visual pedagogical format: 'concept_and_bullets' (definition + 2-4 bullet points), 'comparison_table' (Markdown table contrasting categories/tradeoffs), 'process_flowchart' (flowchart sequence [A] ---> [B] ---> [C]), 'formula_and_derivation' (equation & derivation steps), 'worked_example', or 'socratic_synthesis'."
                            },
                            "board_intent": {
                                "type": "string",
                                "description": "What to draw, write, or format on the chalkboard (e.g. comparison table, flowchart, definition with bullets, formula, note)"
                            }
                        },
                        "required": ["id", "title", "goal", "board_intent"]
                    }
                },
                "order": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "The sequential order of subtopic IDs."
                }
            },
            "required": ["prompt_type", "topic", "pedagogical_goal", "subtopics", "order"]
        }
    }
}


PLANNER_SYSTEM_PROMPT = """\
You are an expert master curriculum planner and university educational architect.
Before a professor begins teaching at the chalkboard, your job is to:
1. FIRST, analyze and categorize the student's prompt into the appropriate pedagogical scope (`prompt_type`).
2. SECOND, structure the milestones with RICH FORMAT VARIETY (never repeat generic definition/formula pairs):
   - At least one milestone should use `format_strategy: "concept_and_bullets"` (Topic heading, 1-sentence definition, 2-4 key bullet points).
   - If there are multiple categories, classifications, algorithms, or approaches, MANDATE `format_strategy: "comparison_table"` (Markdown table comparing categories).
   - If there is a process, cycle, pipeline, or architecture, MANDATE `format_strategy: "process_flowchart"` ([ Input ] ---> [ Processing ] ---> [ Output ]).
   - For mathematical derivations or governing laws, use `format_strategy: "formula_and_derivation"`.
   - Conclude with `format_strategy: "socratic_synthesis"` for the capstone check.
3. THEN, generate an adaptive, appropriately sized lesson plan matching that exact category.

STEP 1: MANDATORY PROMPT CATEGORIZATION (`prompt_type`):
- `conversational`:
  * Prompts: Greetings ("hi", "hello"), chit-chat ("who are you?", "can you help me?", "what can you teach?"), general inquiries.
  * Plan Structure: Exactly 1 lightweight step. Welcome the student, outline available subjects, and invite them to name a topic or problem.
- `simple_doubt`:
  * Prompts: Quick factual or conceptual doubts ("what is the unit of force?", "is 0 a prime number?", "what does ACID stand for?", "why is water polar?").
  * Plan Structure: 1 to 2 targeted steps. Deliver the direct, clear answer with immediate intuition and a simple clarifying example, plus an optional quick check.
- `concept`:
  * Prompts: A single focused mechanism, theorem, formula, or law ("chain rule", "ACID properties", "Newton's second law", "quicksort partition", "Bayes theorem").
  * Plan Structure: As many stages as needed to rigorously derive, explain, and verify the concept:
    - Intuition & Statement (what it is, the 'why', definition + bullet points).
    - Structured Comparison or Architecture Flow (comparison table or flowchart).
    - Step-by-Step Worked Mechanism or Demonstration (derivation or code trace).
    - Socratic Check Question (verifying comprehension).
- `topic`:
  * Prompts: A standard modular curricular unit ("paging in OS", "projectile motion", "binary search trees", "photosynthesis", "friction").
  * Plan Structure: An in-depth sequence of whatever stages are needed:
    - Motivation & Problem Framing (the naive limitation, why this approach is needed).
    - Fundamental Principles & Core Mental Model (topic heading, definition, bullet points).
    - Detailed Mechanism, Categorical Table, or Flow Diagram (how it works step-by-step).
    - Deep-Dive Application or Worked Problem.
    - Synthesis & Socratic Comprehension Check.
- `chapter_or_subject`:
  * Prompts: Broad, expansive subjects or multi-component chapters ("explain dbms", "operating systems", "microeconomics", "thermodynamics", "organic chemistry", "computer networks", "machine learning").
  * Plan Structure: A COMPLETE, RIGOROUS UNIVERSITY-LEVEL CURRICULUM (typically 8 to 15+ comprehensive modules covering foundations, schemas, architecture flowcharts, categorical comparison tables, internal storage, query pipelines, and concurrency).

STEP 2: CURRICULAR RULES:
- REMOVE ALL STRICT STEP LIMITS: Let the curriculum expand naturally to whatever depth the topic or subject demands. Do NOT cap stages.
- An expansive subject/chapter MUST be a full comprehensive syllabus covering all essential components from foundations to internal mechanisms.
- Keep simple doubts (1-2 steps) and conversational greetings (1 step) concise, while allowing concepts, topics, chapters, and subjects to plan as many rich stages as needed.
- Output strictly via the `create_lesson_plan` tool.
"""

from agent.core.pedagogical_classifier import PedagogicalArchetypeClassifier


class LessonPlanner:
    """Generates and manages dynamic educational lesson plans."""

    def __init__(self):
        self.archetype_classifier = PedagogicalArchetypeClassifier()

    def generate_lesson_plan(
        self,
        topic: str,
        subject: str = "General",
        student_query: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes an extra planning LLM call before teaching begins.
        Falls back gracefully to a structured heuristic plan if LLM is unavailable.
        """
        clean_topic = topic.strip() if topic else "General Concepts"
        context_query = f" Student's specific question: '{student_query}'" if student_query else ""

        full_query = f"{clean_topic} {student_query or ''}".strip()
        classification = self.archetype_classifier.classify(full_query, subject=subject)

        messages = [
            {"role": "system", "content": f"{PLANNER_SYSTEM_PROMPT}\n\n[PEDAGOGICAL ARCHETYPE: {classification.archetype.upper()}]\n{classification.structural_rules}"},
            {
                "role": "user",
                "content": f"Subject: {subject}\nTopic: {clean_topic}.{context_query}\nPedagogical Archetype: {classification.archetype}\n\nCategorize this query into prompt_type and generate the complete adaptive structured lesson plan with varied format_strategy across stages now."
            }
        ]

        try:
            response = run_llm(
                messages=messages,
                tools=[LESSON_PLAN_TOOL],
                tool_choice={"type": "function", "function": {"name": "create_lesson_plan"}}
            )

            plan_dict = None
            if isinstance(response, dict) and response.get("tool_calls"):
                tc = response["tool_calls"][0]
                args = tc.get("function", {}).get("arguments", {})
                if isinstance(args, str):
                    args = json.loads(args)
                plan_dict = args
            elif isinstance(response, dict) and "name" in response:
                args = response.get("arguments", {})
                if isinstance(args, str):
                    args = json.loads(args)
                plan_dict = args
            elif isinstance(response, str):
                try:
                    # Look for JSON block in markdown
                    import re
                    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", response, re.DOTALL)
                    if match:
                        plan_dict = json.loads(match.group(1))
                    else:
                        plan_dict = json.loads(response)
                except Exception:
                    pass

            if plan_dict and isinstance(plan_dict.get("subtopics"), list) and plan_dict["subtopics"]:
                # Ensure status tracking on each subtopic
                for idx, st in enumerate(plan_dict["subtopics"]):
                    if "status" not in st:
                        st["status"] = "teaching" if idx == 0 else "pending"
                    if "id" not in st:
                        st["id"] = f"step_{idx+1}"

                if "order" not in plan_dict:
                    plan_dict["order"] = [st["id"] for st in plan_dict["subtopics"]]

                plan_dict["current_index"] = 0
                plan_dict["created_at"] = time.time()
                p_type = plan_dict.get("prompt_type", "topic")
                logger.info(f"Lesson plan generated for '{clean_topic}' (type: {p_type}) with {len(plan_dict['subtopics'])} subtopics.")
                return plan_dict

        except Exception as e:
            logger.warning(f"Planning LLM call encountered error: {e}. Utilizing structured fallback planner.")

        return self._generate_fallback_plan(clean_topic, subject, student_query)

    def _generate_fallback_plan(
        self,
        topic: str,
        subject: str,
        student_query: Optional[str] = None
    ) -> Dict[str, Any]:
        """Heuristic fallback plan categorized by prompt scope."""
        query_lower = (student_query or topic or "").lower().strip()
        title_topic = topic.replace("_", " ").title()

        # Heuristic classification
        if any(query_lower.startswith(g) for g in ["hi", "hello", "hey", "greetings", "who are you"]):
            prompt_type = "conversational"
            subtopics = [{
                "id": "step_1",
                "title": "Welcome & Topic Selection",
                "goal": "Greet the student, outline tutoring capabilities, and invite them to pick a topic.",
                "definitions": [],
                "formulae": [],
                "board_intent": "Display friendly greeting and subject exploration list.",
                "status": "teaching"
            }]
        elif any(w in query_lower for w in ["what is the unit", "stand for", "is 0", "is 1", "why is the sky", "definition of"]):
            prompt_type = "simple_doubt"
            subtopics = [
                {
                    "id": "step_1",
                    "title": f"Direct Answer & Intuition: {title_topic}",
                    "goal": f"Deliver the clear, direct answer to the student's doubt regarding {title_topic}.",
                    "definitions": [f"Key Definition: {title_topic}"],
                    "formulae": [],
                    "board_intent": f"Write direct answer and clarifying note on {title_topic}.",
                    "status": "teaching"
                },
                {
                    "id": "step_2",
                    "title": "Quick Verification & Common Traps",
                    "goal": "Highlight why this distinction matters and check understanding.",
                    "definitions": [],
                    "formulae": [],
                    "board_intent": "Display quick takeaway and check question.",
                    "status": "pending"
                }
            ]
        elif any(s in query_lower for s in ["dbms", "database", "operating system", "os", "compiler", "networking", "economics", "thermodynamics"]):
            prompt_type = "chapter_or_subject"
            subtopics = [
                {
                    "id": "step_1",
                    "title": f"Motivation & Baseline Limitations: Why {title_topic}?",
                    "goal": f"Establish why {title_topic} was invented by contrasting with the limitations of naive file systems and ad-hoc storage.",
                    "definitions": [f"Core Purpose of {title_topic}", "Data Redundancy & Concurrency Anomalies"],
                    "formulae": [],
                    "board_intent": f"Write heading '{title_topic}' and contrast naive file systems vs {title_topic}.",
                    "status": "teaching"
                },
                {
                    "id": "step_2",
                    "title": "Data Models, Formal Schemas & Integrity Constraints",
                    "goal": "Introduce relations, attributes, tuples, primary keys, foreign keys, and referential integrity.",
                    "definitions": ["Relation / Table", "Tuples & Attributes", "Primary Key & Foreign Key", "Referential Integrity"],
                    "formulae": ["R(A_1, A_2, ..., A_n)"],
                    "board_intent": "Display relational schema diagram and key constraints.",
                    "status": "pending"
                },
                {
                    "id": "step_3",
                    "title": "Relational Algebra & Declarative Query Operations",
                    "goal": "Explain how data is retrieved declaratively using selection, projection, Cartesian product, and joins.",
                    "definitions": ["Selection (σ)", "Projection (π)", "Natural Join (⋈)"],
                    "formulae": ["σ_{condition}(R)", "π_{attributes}(R)", "R ⋈_{join_cond} S"],
                    "board_intent": "Write relational algebra operators and worked selection/join example.",
                    "status": "pending"
                },
                {
                    "id": "step_4",
                    "title": f"{title_topic} Internal Architecture & Query Pipeline",
                    "goal": "Trace a request through Parser, Query Optimizer, Execution Engine, and Buffer Pool.",
                    "definitions": ["Query Parser", "Cost-Based Optimizer", "Execution Engine", "Buffer Manager"],
                    "formulae": [],
                    "board_intent": "Draw clean architectural flow diagram: App -> Parser -> Optimizer -> Engine -> Storage.",
                    "status": "pending"
                },
                {
                    "id": "step_5",
                    "title": "Physical Storage, Page Organization & Buffer Pool",
                    "goal": "Explain how tables are mapped to disk blocks, slotted-page architecture, and memory caching.",
                    "definitions": ["Slotted Page Format", "Page Header & Record Pointers", "Buffer Pool Eviction (LRU/Clock)"],
                    "formulae": [],
                    "board_intent": "Diagram a slotted page layout showing header, slot directory, and records.",
                    "status": "pending"
                },
                {
                    "id": "step_6",
                    "title": "Indexing & B+ Trees for High-Speed Retrieval",
                    "goal": "Explain search keys, B+ tree node structures, leaf node chaining, and range queries.",
                    "definitions": ["B+ Tree Index", "Search Key", "Leaf Pointers & Range Scans"],
                    "formulae": ["O(log_B N) search complexity"],
                    "board_intent": "Draw a multi-level B+ Tree diagram highlighting root, internal nodes, and linked leaf nodes.",
                    "status": "pending"
                },
                {
                    "id": "step_7",
                    "title": "Transactions & ACID Guarantees",
                    "goal": "Formulate why concurrent and fault-tolerant executions require Atomicity, Consistency, Isolation, and Durability.",
                    "definitions": ["Atomicity", "Consistency", "Isolation", "Durability"],
                    "formulae": [],
                    "board_intent": "Create ACID guarantees summary table with real-world banking scenario.",
                    "status": "pending"
                },
                {
                    "id": "step_8",
                    "title": "Concurrency Control & Two-Phase Locking (2PL)",
                    "goal": "Demonstrate how conflict serializability, Shared/Exclusive locks, and Strict 2PL prevent race conditions.",
                    "definitions": ["Strict 2-Phase Locking (2PL)", "Shared (S) & Exclusive (X) Locks", "Deadlock Detection"],
                    "formulae": ["Phase 1: Growing (acquire locks)", "Phase 2: Shrinking (release locks)"],
                    "board_intent": "Draw lock compatibility matrix and 2PL growing/shrinking timeline.",
                    "status": "pending"
                },
                {
                    "id": "step_9",
                    "title": "Crash Recovery & Write-Ahead Logging (WAL)",
                    "goal": "Explain how the system survives sudden power loss using WAL protocols and ARIES redo/undo passes.",
                    "definitions": ["Write-Ahead Logging (WAL)", "Log Sequence Number (LSN)", "Checkpoints & ARIES"],
                    "formulae": ["Rule: Log record flushed before dirty page to disk"],
                    "board_intent": "Diagram WAL sequence on disk showing Redo and Undo recovery phases.",
                    "status": "pending"
                },
                {
                    "id": "step_10",
                    "title": "Distributed Architectures, Modern Systems & Capstone Check",
                    "goal": "Synthesize the entire architecture, compare modern systems (PostgreSQL, distributed engines), and present a capstone challenge.",
                    "definitions": ["Distributed Transactions", "Replication & Partitioning", "Modern Database Trade-offs"],
                    "formulae": [],
                    "board_intent": "Display high-level system trade-offs map and capstone Socratic question.",
                    "status": "pending"
                }
            ]
        else:
            prompt_type = "topic"
            subtopics = [
                {
                    "id": "step_1",
                    "title": f"Motivation & Problem Framing: {title_topic}",
                    "goal": f"Establish intuition and problem framing for {title_topic}.",
                    "definitions": [f"Definition of {title_topic}"],
                    "formulae": [],
                    "board_intent": f"Write heading '{title_topic}' and core definition.",
                    "status": "teaching"
                },
                {
                    "id": "step_2",
                    "title": "Core Principles & Governing Mechanism",
                    "goal": f"Walk through fundamental principles, governing equation, or mechanism.",
                    "definitions": ["Governing Terms"],
                    "formulae": [f"Primary relation for {title_topic}"],
                    "board_intent": "Display primary formula or structure diagram.",
                    "status": "pending"
                },
                {
                    "id": "step_3",
                    "title": "Worked Example & Socratic Check",
                    "goal": "Verify comprehension through a focused worked application or check question.",
                    "definitions": [],
                    "formulae": [],
                    "board_intent": "Display worked step and check question.",
                    "status": "pending"
                }
            ]

        return {
            "prompt_type": prompt_type,
            "topic": title_topic,
            "subject": subject,
            "pedagogical_goal": f"Master the fundamental mechanisms, representations, and application of {title_topic}.",
            "subtopics": subtopics,
            "order": [st["id"] for st in subtopics],
            "current_index": 0,
            "created_at": time.time()
        }

    @staticmethod
    def format_plan_guidance(plan: Dict[str, Any]) -> str:
        """Converts active lesson plan into actionable runtime guidance for the professor agent."""
        if not plan:
            return ""

        topic = plan.get("topic", "Topic")
        goal = plan.get("pedagogical_goal", "")
        subtopics = plan.get("subtopics", [])
        curr_idx = plan.get("current_index", 0)

        lines = [
            f"Topic: {topic}",
            f"Overarching Goal: {goal}" if goal else "",
            "Lesson Progression & Plan State:"
        ]

        for idx, st in enumerate(subtopics):
            status = st.get("status", "pending").upper()
            marker = "▶ [CURRENT FOCUS]" if idx == curr_idx else f"[{status}]"
            defs = f" (Definitions: {', '.join(st.get('definitions', []))})" if st.get("definitions") else ""
            forms = f" (Formulae: {', '.join(st.get('formulae', []))})" if st.get("formulae") else ""
            lines.append(f"  {idx + 1}. {marker} {st.get('title')}: {st.get('goal')}{defs}{forms}. Board: {st.get('board_intent')}")

        return "\n".join([line for line in lines if line]).strip()

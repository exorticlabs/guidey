"""
professor_prompt.py — Structured Prompt, Dynamic Archetype Classifier, and Phonetic Math Guide.

Features:
1. Dynamic Pedagogical Archetype Classification (Problem Solving, Science, Coding, Mechanisms, Hybrid).
2. Domain-Specific Few-Shot Exemplars injected at runtime.
3. Phonetic Math Verbalization Rules (clean TTS without raw LaTeX code).
4. Single-Pass Tool Calling (`professor_step`).
"""
from typing import Dict, Any, List, Optional
from agent.core.state import SessionState
from agent.core.pedagogical_classifier import PedagogicalArchetypeClassifier, is_conversational_message

archetype_classifier = PedagogicalArchetypeClassifier()

PROFESSOR_STEP_TOOL: Dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "professor_step",
        "description": "Perform one teaching step at the physical chalkboard: write structured visual content, speak engagingly to the student, and control lecture progression.",
        "parameters": {
            "type": "object",
            "properties": {
                "board_writes": {
                    "type": "array",
                    "description": "Visual elements to write or display on the chalkboard. Leave empty ([]) for pure conversational turns or greetings.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "action": {
                                "type": "string",
                                "enum": ["write", "highlight", "box", "erase"],
                                "description": "'write' to add content to board; 'highlight' to emphasize; 'box' to box final answers or core laws; 'erase' to wipe canvas."
                            },
                            "kind": {
                                "type": "string",
                                "enum": [
                                    "heading",      # Main lesson topic title
                                    "subtopic",     # Milestone subtopic title
                                    "definition",   # Clear term definition
                                    "bullet_list",  # Structured key points, characteristics, or pros/cons
                                    "table",        # Comparison or categorization table (Markdown | col1 | col2 |)
                                    "flowchart",    # Sequential process / architecture ([A] ---> [B] ---> [C])
                                    "equation",     # Mathematical formula in LaTeX ($$...$$)
                                    "step",         # Derivation or worked problem step
                                    "code",         # Code snippet or algorithm
                                    "diagram"       # Conceptual visual or IMAGE: <query>
                                ],
                                "description": "The pedagogical content format for this chalkboard item."
                            },
                            "content": {
                                "type": "string",
                                "description": "The formatted text, LaTeX math, Markdown table, flowchart arrows, or bullet points to write on the board."
                            },
                            "sub_term": {
                                "type": "string",
                                "description": "Optional specific sub-term to highlight or box (e.g. 'O(n log n)', 'E = mc^2')."
                            }
                        },
                        "required": ["action", "kind", "content"]
                    }
                },
                "speech": {
                    "type": "string",
                    "description": "Spoken explanation for this turn. Engaging, conversational, and clear. Never speak raw LaTeX or raw SVG tags."
                },
                "gesture": {
                    "type": "string",
                    "enum": ["explain", "point_board", "write", "encourage", "think", "listen", "celebrate"],
                    "description": "Avatar gesture during this step."
                },
                "yield": {
                    "type": "string",
                    "enum": ["continue", "ask", "yield"],
                    "description": "'yield' if explanation is complete; 'ask' if asking a check question; 'continue' if executing an immediate follow-up board step."
                },
                "question": {
                    "type": "string",
                    "description": "If yield == 'ask', the short check question to verify student comprehension."
                }
            },
            "required": ["board_writes", "speech", "gesture", "yield"]
        }
    }
}


BASE_PROFESSOR_PROMPT = """\
You are an inspiring, charismatic master professor giving an interactive live lecture at a physical chalkboard.
Your goal is deep conceptual clarity, intuition, and engaging student interaction across any discipline.

CRITICAL TEACHING PRINCIPLES:
1. TEACHING FOCUS & SPOKEN CLARITY (NEVER META-NARRATIVE):
   - Speak naturally and enthusiastically as a real human teacher in front of a lecture hall.
   - ABSOLUTE BAN ON META-DESCRIPTIONS:
     * NEVER narrate your own board-writing actions (do NOT say "Notice on the board I have written...", "Below this I placed...", "To frame our discussion...").
     * Instead, TEACH THE CONCEPT directly with vivid intuition, real-world analogies, and motivating examples.
   - The chalkboard is your visual companion: you write clean summaries, equations, diagrams, and notes on the board, while what you SPEAK provides intuition and clarity.
   - SPOKEN MATH: Pronounce formulas in clear, natural conversational English (e.g. "a over b", "x squared", "the square root of x"). Never speak raw LaTeX syntax.

2. STRUCTURED PEDAGOGICAL CONTENT FORMATTING:
   Every lesson must follow clean, readable academic structure rather than repeating generic definitions:
   - TOPIC & SUBTOPICS:
     * Use kind: "heading" for the main lesson title at the beginning.
     * Use kind: "subtopic" for distinct milestone sections (e.g. "1. Motivation & Core Idea", "2. Categorical Comparison", "3. Step-by-Step Mechanism").
   - DEFINITIONS & BULLET POINTS:
     * Use kind: "definition" for clean 1-2 sentence core definitions.
     * Follow with kind: "bullet_list" for 2 to 4 bullet points.
     * MANDATORY BREVITY FOR BULLET POINTS:
       - Every bullet point must be a SHORT, TELEGRAPHIC bullet phrase (max 10 to 15 words per bullet).
       - NEVER write full conversational essays or dense paragraphs as bullets.
       - Good example:
         * "• Invariant to input scale factors"
         * "• Eliminates gradient zig-zag oscillations"
         * "• Centers zero-mean data for faster descent"
       - Bad example: Writing 40-word multi-clause complex paragraphs inside a bullet point.
   - STRUCTURED COMPARISON TABLES:
     * When discussing 2 or more categories, classifications, algorithms, or tradeoffs, ALWAYS use kind: "table" with standard Markdown table syntax (| Feature | Category A | Category B |).
     * The chalkboard automatically renders these into beautiful, hand-drawn chalk comparison tables!
   - PROCESS FLOWCHARTS & MECHANISMS:
     * For multi-step cycles, workflows, or architectures, use kind: "flowchart" with clean bracketed nodes:
       `[ Source / Input ] ---> [ Transformation / Processing ] ---> [ Sink / Output ]`
   - MATHEMATICAL DERIVATIONS & CODE:
     * Use kind: "equation" with clean LaTeX ($$ ... $$) for governing laws.
     * Use kind: "step" for step-by-step algebra or derivations.
     * Use kind: "code" for clean, well-commented algorithms.

3. SOCRATIC QUESTIONS (NEVER SPOIL THE ANSWER):
   - When yield == "ask", your speech should lead the student to the edge of the concept and prompt THEM to deduce the consequence.
   - NEVER state the answer in speech right before asking the question.
   - Keep the question focused, intuitive, and answerable in 1-2 sentences.

4. RESPONDING TO STUDENT ANSWERS & INTERACTIONS:
   - When a student responds to a question:
     * Acknowledge warmly ("Spot on!", "Exactly right—...", or "Good thinking! Let's examine that...").
     * Reinforce the key takeaway in one concise sentence.
     * Seamlessly advance to the active planned stage of the lesson.
     * Never restart from Step 0 or rewrite the main topic heading when a student answers.

5. CONVERSATIONAL TURNS & GREETINGS:
   - When the student sends a greeting ("hi", "hello"), a pleasantry, or an acknowledgement ("ok", "got it", "thanks"):
     * Do NOT lecture on unprompted academic topics.
     * Keep your response concise, warm, and natural (1 to 2 sentences).
     * Leave the chalkboard untouched (board_writes: []).
     * Set yield: "yield".
"""

CHALKBOARD_DIAGRAM_RULES = """\
[CHALKBOARD VISUAL ARTIFACTS & FORMATS]
Support your explanation with clear, structured chalkboard elements:
1. STRUCTURED COMPARISON TABLE:
   Use kind: "table" with standard Markdown (| Feature | Type A | Type B |).
2. ARCHITECTURE & PROCESS FLOW:
   Use kind: "flowchart" with bracketed blocks:
   `[ Stage 1: Input ] ---> [ Stage 2: Processing ] ---> [ Stage 3: Output ]`
3. EDUCATIONAL REFERENCE IMAGE:
   Use kind: "diagram" with: `IMAGE: <topic or organelle or apparatus>` (e.g. `IMAGE: mitochondrion organelle diagram` or `IMAGE: quicksort recursion tree`).
   The system automatically resolves verified high-resolution scientific diagrams from Wikimedia Commons!
4. DATA SCATTER / INTERACTIVE PLOT:
   Use kind: "diagram" with POINTS: (x1, y1), (x2, y2)... for coordinate plots.
"""


def build_professor_messages(
    state: SessionState,
    student_message: Optional[str] = None,
    step_index: int = 0,
    max_steps: Optional[int] = None,
    guidance: Optional[str] = None,
    history: Optional[List[Dict[str, str]]] = None
) -> List[Dict[str, str]]:
    """
    Constructs the message payload for the LLM with dynamic archetype classification,
    clean conversational rules, lesson plan sequencing, and active curriculum guidance.
    """
    query_text = student_message or state.topic or ""
    classification = archetype_classifier.classify(query_text, subject=state.subject)

    system_content = f"""{BASE_PROFESSOR_PROMPT}

{CHALKBOARD_DIAGRAM_RULES}

{classification.structural_rules}

{classification.exemplar_prompt}
"""
    # Inject active lesson plan state and current stage focus
    plan_guidance = state.get_plan_summary()
    if plan_guidance:
        system_content += f"\n[ACTIVE LESSON PLAN & PROGRESSION]\n{plan_guidance}\n"

    if guidance and guidance != plan_guidance:
        system_content += f"\n[CURRICULUM GUIDANCE]\n{guidance}\n"

    # Active curriculum milestone details
    curr_plan_item = state.get_current_plan_item()
    plan_title = curr_plan_item.get("title", "") if curr_plan_item else ""
    plan_goal = curr_plan_item.get("goal", "") if curr_plan_item else ""
    plan_defs = ", ".join(curr_plan_item.get("definitions", [])) if curr_plan_item else ""
    plan_formulae = ", ".join(curr_plan_item.get("formulae", [])) if curr_plan_item else ""
    plan_board_intent = curr_plan_item.get("board_intent", "") if curr_plan_item else ""
    plan_subtopics = state.plan.get("subtopics", []) if state.plan else []
    plan_total = len(plan_subtopics)
    curr_idx = state.plan_current_index
    is_final_step = (curr_idx >= plan_total - 1) if plan_total > 0 else False

    # Only show subject if it is not generic
    subject_display = state.subject if state.subject and state.subject.lower() not in ["general", "general discussion", "none"] else "Open Academic Inquiry"
    topic_display = state.topic if state.topic and state.topic.lower() not in ["general", "general discussion", "none"] else "Open Discussion"

    user_context = f"""SUBJECT: {subject_display}
TOPIC: {topic_display}
TEACHING STYLE: {classification.archetype.replace('_', ' ').title()}

{state.get_board_summary()}
"""

    format_strategy = curr_plan_item.get("format_strategy", "") if curr_plan_item else ""
    format_guidance = ""
    if format_strategy == "comparison_table" or "table" in plan_board_intent.lower() or "comparison" in plan_title.lower() or "vs" in plan_title.lower():
        format_guidance = "\n- CHALKBOARD FORMAT: Structure content with a comparison table (kind: 'table' with | Feature | Category A | Category B |)."
    elif format_strategy == "process_flowchart" or "flow" in plan_board_intent.lower() or "pipeline" in plan_board_intent.lower() or "cycle" in plan_title.lower():
        format_guidance = "\n- CHALKBOARD FORMAT: Structure content with a process flowchart (kind: 'flowchart' with [ Stage 1 ] ---> [ Stage 2 ] ---> [ Stage 3 ])."
    elif format_strategy == "concept_and_bullets" or curr_idx == 0:
        format_guidance = "\n- CHALKBOARD FORMAT: Structure with a clean definition (kind: 'definition') followed by 2-4 structured bullet points (kind: 'bullet_list')."
    elif plan_formulae:
        format_guidance = f"\n- CHALKBOARD FORMAT: Present governing formula ($$ ... $$) and derivation steps (kind: 'equation', 'step')."

    if curr_plan_item:
        user_context += f"""
[CURRENT CURRICULUM TARGET — WHAT TO TEACH NOW]:
- Active Milestone: Stage {curr_idx + 1} of {plan_total}: '{plan_title}'
- Milestone Goal: {plan_goal}
- Focus Concepts: {plan_defs or 'Key conceptual principles'} {format_guidance}
- Board Visual Objective: {plan_board_intent or 'Present clear visual breakdown'}
"""

    messages = [
        {"role": "system", "content": system_content},
        {"role": "user", "content": user_context}
    ]

    # Include recent dialogue turns so the agent has conversational memory
    if history:
        clean_history = []
        for h in history[-4:]:
            role = "assistant" if h.get("role") in ["assistant", "ai"] else "user"
            content = h.get("content", "")
            if content and not content.startswith("```component"):
                clean_history.append(f"{'TUTOR' if role == 'assistant' else 'STUDENT'}: {content[:200]}")
        if clean_history:
            messages.append({
                "role": "user",
                "content": f"[RECENT DIALOGUE CONTEXT]:\n" + "\n".join(clean_history)
            })

    # Handle pure conversational turns (greetings, small talk, acknowledgements)
    if student_message and is_conversational_message(student_message):
        messages.append({
            "role": "user",
            "content": (
                f"STUDENT SAYS: {student_message}\n\n"
                "The student has sent a friendly greeting, pleasantry, or casual remark.\n"
                "1. Respond warmly, naturally, and concisely in 1 to 2 sentences.\n"
                "2. Do NOT invent, assume, or lecture on unprompted academic topics.\n"
                "3. Do NOT write on the chalkboard (keep board_writes: [] empty).\n"
                "4. Ask what subject, problem, or topic they would like to explore today.\n"
                "5. Set gesture: 'encourage' or 'explain', and set yield: 'yield'."
            )
        })
        return messages

    # Determine if this is a brand new lesson start vs. continuing an active lesson
    is_brand_new_topic = (step_index == 0 and len(state.nodes) == 0 and curr_idx == 0)

    if student_message and is_brand_new_topic:
        stage_desc = f"'{plan_title}': {plan_goal}" if plan_title else "Introduce the foundational intuition, definitions, or motivating problem."
        messages.append({
            "role": "user",
            "content": (
                f"STUDENT ASKS: {student_message}\n\n"
                f"Begin Lesson Step 0 — {stage_desc}\n"
                "Teach the concept with clear intuition, concrete examples, and real-world clarity. "
                "Write the Topic Heading and key initial concept or equation on the chalkboard. "
                "Set yield: 'yield' when your explanation is complete so the student can respond, or 'continue' only if an immediate follow-up board step is underway."
            )
        })
    elif step_index > 0 and not student_message:
        yield_hint = (
            "This is the final capstone stage of our curriculum! Synthesize key insights and set yield: 'yield' or 'ask' with a concluding check question."
            if is_final_step else
            "Advance cleanly through this module. Set yield: 'yield' or 'ask' when you finish this module (or set yield: 'continue' only if an immediate second chalkboard demonstration follows)."
        )
        messages.append({
            "role": "user",
            "content": (
                f"Advance to Stage {curr_idx + 1}: '{plan_title}'. "
                f"Goal: {plan_goal}. "
                f"Board Target: {plan_board_intent or 'Present clear visual breakdown'}. {format_guidance} "
                "Explain the concepts with clear intuition, concrete examples, and real-world clarity. "
                "Use structured chalkboard writes (topics, subtopics, definitions + bullet points, tables, flowcharts, or equations). "
                f"{yield_hint}"
            )
        })
    else:
        # Student responding / continuing in an ongoing lesson
        stage_desc = f"'{plan_title}' ({plan_goal})" if plan_title else f"the active concept in {state.topic}"
        student_label = "STUDENT ASKS" if (student_message and student_message.strip().endswith("?")) else "STUDENT SAYS / ANSWERS"
        messages.append({
            "role": "user",
            "content": (
                f"{student_label}: {student_message}\n\n"
                f"The student is interacting in our ongoing lesson on {state.topic}! "
                "1. If they answered your previous check question, warmly acknowledge and validate their answer. "
                f"2. Seamlessly advance to teach the active planned stage: {stage_desc}. "
                f"   - Board visual target: {plan_board_intent or 'Present clear visual breakdown'}\n"
                f"   {format_guidance}\n"
                "3. Explain with rich intuition, structured notes (definitions, bullet points, tables, flowcharts), and concrete examples. "
                "4. Do NOT restart from Step 0, do NOT rewrite the main topic heading, and NEVER say 'Notice on the board I wrote...'."
            )
        })

    return messages

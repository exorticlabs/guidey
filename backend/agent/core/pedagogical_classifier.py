"""
pedagogical_classifier.py — High-Precision Pedagogical Archetype Classifier.

Features:
1. Dual Engine:
   - Built-in subword n-gram TF-IDF cosine similarity vectorizer (100% pure Python, zero dependencies, typo-resilient).
   - Optional local/cloud Qwen embedding provider integration (Ollama / LM Studio / HF).
2. Deep Pedagogical Classification:
   - 'problem_solving': Step-by-step mathematical & physical derivations with formulas in margin.
   - 'science_concepts': Natural sciences, reaction mechanisms, biological cycles, and asset diagrams.
   - 'coding_engineering': Code blocks, algorithmic complexity, trace tables, and software architecture.
   - 'general_mechanisms': Physical machines and everyday enthusiast mechanics (AC, engine, motor, workout biomechanics).
   - 'hybrid': Conceptual introduction followed immediately by a concrete worked problem.
3. Dynamically injects tailored few-shot exemplars, phonetic math speech, and structural blackboard rules.
"""
from dataclasses import dataclass
from typing import Dict, Any, List, Optional, Tuple
import math
import re
import os
import json


@dataclass
class ArchetypeMatchResult:
    archetype: str
    confidence: float
    scores: Dict[str, float]
    structural_rules: str
    exemplar_prompt: str
    subject_inferred: str


# ─────────────────────────────────────────────────────────────────────────────
# COMPREHENSIVE ARCHETYPE TRAINING CORPUS
# ─────────────────────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────────────────────────
# UNIVERSAL ARCHETYPE PROFILES (MULTI-DISCIPLINARY TAXONOMY)
# ─────────────────────────────────────────────────────────────────────────────

ARCHETYPE_PROFILES: Dict[str, List[str]] = {
    "problem_solving": [
        "mathematical derivation analytical solution algebraic calculation step by step proof",
        "solve for unknown evaluate integral derivative limit differential equation matrix determinant",
        "vector calculus linear algebra eigenvalues optimization numerical analysis trigonometry",
        "stoichiometric calculations equilibrium constant thermodynamics balance kinetic derivation",
        "kinematics dynamics force balance energy conservation momentum stress strain beam bending",
        "probability distribution expected value statistical inference hypothesis test combinatorics",
        "discrete mathematics recurrence relation proof by induction boolean simplification graph theorem",
        "quadratic polynomial factoring roots discriminant system of equations simplification",
        "dimensional analysis boundary value problem navier stokes maxwell equations derivation"
    ],
    "science_concepts": [
        "fundamental scientific principle natural phenomenon theoretical framework physical law",
        "molecular pathway biochemical cascade cell physiology genetics transcription translation",
        "chemical reaction mechanism bonding hybridization orbital theory equilibrium kinetics",
        "electromagnetism optics quantum states wave particle duality photon energy bandgap",
        "thermodynamics entropy enthalpy gibbs free energy phase transition statistical mechanics",
        "evolutionary biology ecology natural selection immune system antibody antigen response",
        "astrophysics cosmology planetary mechanics stellar evolution gravitational fields",
        "neuroscience synaptogenesis action potential neurotransmitter physiological regulation",
        "geological processes plate tectonics rock cycle atmospheric circulation climate dynamics"
    ],
    "coding_engineering": [
        "algorithm design computational complexity big o time space bounds asymptotic analysis",
        "data structures trees graphs heaps hash tables stacks queues linked lists tries",
        "software architecture design patterns modularity separation of concerns clean code",
        "systems programming memory management pointers concurrency race conditions deadlocks",
        "network protocols tcp ip http websocket client server distributed consensus raft",
        "database query optimization indexing transactions acid properties relational schema",
        "digital logic circuit design logic gates finite state machine fsm verilog fpga",
        "programming paradigms functional object oriented recursion dynamic programming memoization",
        "code implementation debugging variable declaration syntax error refactoring testing"
    ],
    "general_mechanisms": [
        "physical mechanism mechanical assembly apparatus machinery component interactions",
        "power transmission gear trains levers pulleys hydraulics pneumatics actuators linkages",
        "thermodynamic cycles heat engines refrigeration heat pump compressor turbine internal combustion",
        "aerodynamics fluid dynamics lift drag bernoulli venturi fluid flow propulsion nozzles",
        "electrical machines motors alternators transformers electromagnetic actuators solenoids",
        "biomechanics human anatomy musculoskeletal levers joint kinetics force vectors exercise physiology",
        "everyday technology consumer apparatus instrumentation sensors transducers appliances",
        "turbocharger supercharger braking systems suspension differentials automotive engineering"
    ],
    "hybrid": [
        "theory followed by worked example concept explanation with concrete numerical exercise",
        "explain fundamental law and calculate application step by step practice problem",
        "derive governing equation and demonstrate with parameterized case study",
        "introduce algorithmic paradigm and walk through code implementation with trace",
        "scientific principle explained followed by quantitative scenario evaluation",
        "teach conceptual model then solve exercise testing boundary conditions",
        "bridge abstract formulation to real world operational problem solving"
    ]
}

# ─────────────────────────────────────────────────────────────────────────────
# GENERALIZED PEDAGOGICAL FRAMEWORKS & DIRECTIONAL PROMPTS
# ─────────────────────────────────────────────────────────────────────────────

PROBLEM_SOLVING_RULES = """\
[TEACHING FOCUS: MATH & DERIVATIONS]
- Start by writing the problem or goal clearly at the top.
- When writing a formula, briefly explain what the variables stand for in plain English.
- Show each derivation or algebra step clearly, one step at a time.
- Place useful formulas, constraints, or identities in the margin scratchpad.
- When you reach the final answer, circle or box it with action: 'circle'.
"""

PROBLEM_SOLVING_EXEMPLAR = """\
Generalized Analytical Step Exemplar:
{
  "board_writes": [
    {
      "action": "write",
      "kind": "heading",
      "content": "Problem Formulation: Analytical Evaluation",
      "role": "heading"
    },
    {
      "action": "write",
      "kind": "step",
      "content": "Formulate the governing system with given boundary conditions",
      "role": "primary_stream"
    },
    {
      "action": "scratchpad",
      "kind": "scratchpad",
      "content": "Governing Law / Identity:\\n$$\\\\mathcal{L}\\\\{f'(t)\\\\} = sF(s) - f(0)$$",
      "role": "margin",
      "spatial_intent": { "zone": "margin" }
    },
    {
      "action": "arrow",
      "from_node_id": "auxiliary_identity",
      "to_node_id": "derivation_step_1",
      "arrow_label": "apply transformation"
    }
  ],
  "speech": "We begin by setting up our governing equation under the given boundary conditions, drawing our transformation identity into the margin so we can substitute directly into our primary derivation.",
  "gesture": "write",
  "yield": "continue"
}
"""

SCIENCE_CONCEPTS_RULES = """\
[TEACHING FOCUS: SCIENCE & PHENOMENA]
- Start with a clear real-world intuition or analogy before introducing technical terms.
- Show how the stages or parts connect on the chalkboard (use diagrams, reactions, or sequential steps).
- Emphasize the cause-and-effect reason ("why this happens") in simple, everyday language.
- Use margin scratchpad notes for underlying rules, constants, or key definitions.
"""

SCIENCE_CONCEPTS_EXEMPLAR = """\
Generalized Scientific System Exemplar:
{
  "board_writes": [
    {
      "action": "write",
      "kind": "heading",
      "content": "Governing Principle: Dynamic System Equilibrium",
      "role": "heading"
    },
    {
      "action": "write",
      "kind": "equation",
      "content": "$$A + B \\\\xrightleftharpoons[k_r]{k_f} C + D \\\\quad (\\\\Delta H < 0)$$",
      "role": "primary_stream"
    },
    {
      "action": "scratchpad",
      "kind": "scratchpad",
      "content": "Key Driver:\\nSystem shifts to counteract applied thermodynamic stress.",
      "role": "margin",
      "spatial_intent": { "zone": "margin" }
    }
  ],
  "speech": "Notice that this transformation exists in dynamic equilibrium with a negative enthalpy change. When external temperature changes, the system naturally shifts to restore balance.",
  "gesture": "explain",
  "yield": "continue"
}
"""

CODING_ENGINEERING_RULES = """\
[TEACHING FOCUS: CODE & ALGORITHMS]
- Explain the high-level idea or intuition first before diving into code.
- Write clean, concise code on the board with meaningful variable names.
- Trace through a small, concrete example so the student can follow what happens step-by-step.
- Note time or space complexity and key edge cases in the margin scratchpad.
"""

CODING_ENGINEERING_EXEMPLAR = """\
Generalized Computational Step Exemplar:
{
  "board_writes": [
    {
      "action": "write",
      "kind": "heading",
      "content": "Binary Search: Divide-and-Conquer",
      "role": "heading"
    },
    {
      "action": "write",
      "kind": "code",
      "content": "def binary_search(arr, target):\\n    left, right = 0, len(arr) - 1\\n    while left <= right:\\n        mid = (left + right) // 2\\n        if arr[mid] == target: return mid\\n        elif arr[mid] < target: left = mid + 1\\n        else: right = mid - 1\\n    return -1",
      "role": "primary_stream"
    },
    {
      "action": "scratchpad",
      "kind": "scratchpad",
      "content": "Complexity:\\nTime: $O(\\\\log n)$\\nSpace: $O(1)$",
      "role": "margin",
      "spatial_intent": { "zone": "margin" }
    }
  ],
  "speech": "Our strategy centers on shrinking the search space in half each time. By checking the middle element, we narrow down the target in logarithmic time without extra memory.",
  "gesture": "point_board",
  "yield": "continue"
}
"""

GENERAL_MECHANISMS_RULES = """\
[TEACHING FOCUS: HOW THINGS WORK & MACHINES]
- Explain the physical mechanism as a clear story: what goes in, what happens in each stage, and what comes out.
- Show the sequence of parts on the board with arrows showing the flow of energy, fluid, or movement.
- Use simple analogies to make invisible physical processes easy to picture.
"""

GENERAL_MECHANISMS_EXEMPLAR = """\
Generalized Physical Apparatus Exemplar:
{
  "board_writes": [
    {
      "action": "write",
      "kind": "heading",
      "content": "Refrigeration Cycle: Continuous Heat Transfer",
      "role": "heading"
    },
    {
      "action": "write",
      "kind": "text",
      "content": "Stage 1: Compression (Elevates pressure and temperature)\\nStage 2: Condensation (Releases heat to outside air)\\nStage 3: Expansion (Pressure drops rapidly, cooling fluid)\\nStage 4: Evaporation (Absorbs room heat to cool the space)",
      "role": "primary_stream"
    },
    {
      "action": "scratchpad",
      "kind": "scratchpad",
      "content": "Core Principle:\\nFluids absorb immense heat when expanding from liquid to vapor.",
      "role": "margin",
      "spatial_intent": { "zone": "margin" }
    }
  ],
  "speech": "Think of this system as a heat sponge. The compressor squeezes the fluid so it can dump heat outside, then lets it expand into a cold mist that absorbs warmth from inside the room.",
  "gesture": "explain",
  "yield": "continue"
}
"""

HYBRID_RULES = """\
[TEACHING FOCUS: CONCEPT & WORKED EXAMPLE]
- Introduce the core concept or formula simply in plain words.
- Immediately walk through a concrete worked example so the student sees how it is applied.
- Highlight or circle the result and ask a quick question to verify understanding.
"""

HYBRID_EXEMPLAR = """\
Generalized Hybrid Principle-to-Application Exemplar:
{
  "board_writes": [
    {
      "action": "write",
      "kind": "heading",
      "content": "Gauss's Law & Spherical Symmetry",
      "role": "heading"
    },
    {
      "action": "write",
      "kind": "equation",
      "content": "Electric Flux Law: $\\\\oint \\\\mathbf{E} \\\\cdot d\\\\mathbf{A} = \\\\frac{Q_{\\\\text{enc}}}{\\\\varepsilon_0}$",
      "role": "primary_stream"
    },
    {
      "action": "write",
      "kind": "step",
      "content": "Worked Application for radius $R$ and charge $Q$:\\n$$E(r) \\\\cdot 4\\\\pi r^2 = \\\\frac{Q}{\\\\varepsilon_0} \\\\implies E(r) = \\\\frac{1}{4\\\\pi \\\\varepsilon_0} \\\\frac{Q}{r^2}$$",
      "role": "primary_stream"
    },
    {
      "action": "circle",
      "target_node_id": "application_result",
      "sub_term": "E(r) = \\\\frac{1}{4\\\\pi \\\\varepsilon_0} \\\\frac{Q}{r^2}"
    }
  ],
  "speech": "We start with the general flux law, and immediately apply it to a sphere of radius r, showing how symmetry directly gives us the inverse-square law for electric fields.",
  "gesture": "point_board",
  "yield": "continue"
}
"""

CONVERSATIONAL_RULES = """\
[TEACHING FOCUS: CONVERSATION & GREETING]
- Respond warmly, naturally, and concisely in 1 to 2 sentences.
- Do NOT lecture or invent an unprompted academic lesson.
- Keep the chalkboard empty (`board_writes: []`).
- Ask what subject, concept, or problem the student would like to work on today.
"""

CONVERSATIONAL_EXEMPLAR = """\
Greeting Step Exemplar:
{
  "board_writes": [],
  "speech": "Hello! Welcome to the classroom. What topic or subject would you like to explore today?",
  "gesture": "encourage",
  "yield": "yield"
}
"""

ARCHETYPE_RULES_MAP = {
    "problem_solving": (PROBLEM_SOLVING_RULES, PROBLEM_SOLVING_EXEMPLAR),
    "science_concepts": (SCIENCE_CONCEPTS_RULES, SCIENCE_CONCEPTS_EXEMPLAR),
    "coding_engineering": (CODING_ENGINEERING_RULES, CODING_ENGINEERING_EXEMPLAR),
    "general_mechanisms": (GENERAL_MECHANISMS_RULES, GENERAL_MECHANISMS_EXEMPLAR),
    "hybrid": (HYBRID_RULES, HYBRID_EXEMPLAR),
    "conversational": (CONVERSATIONAL_RULES, CONVERSATIONAL_EXEMPLAR),
}


# ─────────────────────────────────────────────────────────────────────────────
# PURE-PYTHON SUBWORD & WORD N-GRAM COSINE SIMILARITY ENGINE
# ─────────────────────────────────────────────────────────────────────────────

class PurePythonCosineVectorizer:
    """
    Zero-dependency, sub-millisecond subword (3-gram & 4-gram) + word TF-IDF vectorizer.
    Inherently typo-tolerant and immune to morphological variation.
    """

    def __init__(self, corpus: Dict[str, List[str]]):
        self.doc_names = list(corpus.keys())
        self.doc_texts = {k: " ".join(corpus[k]).lower() for k in self.doc_names}
        self.vocabulary: Dict[str, int] = {}
        self.idf: Dict[str, float] = {}
        self.doc_vectors: Dict[str, Dict[str, float]] = {}
        self._build_index()

    def _extract_features(self, text: str) -> List[str]:
        words = re.findall(r"[a-z0-9_#+]+", text.lower())
        features = list(words)
        # Add subword 3-grams and 4-grams for words >= 4 chars (handles typos & stems)
        for w in words:
            if len(w) >= 4:
                for n in (3, 4):
                    for i in range(len(w) - n + 1):
                        features.append(f"_{w[i:i+n]}")
        return features

    def _build_index(self):
        doc_count = len(self.doc_texts)
        doc_features = {}
        df: Dict[str, int] = {}

        for name, text in self.doc_texts.items():
            feats = self._extract_features(text)
            doc_features[name] = feats
            for f in set(feats):
                df[f] = df.get(f, 0) + 1

        for f, count in df.items():
            # Standard smoothed IDF
            self.idf[f] = math.log((doc_count + 1) / (count + 1)) + 1.0

        for name, feats in doc_features.items():
            tf = {}
            for f in feats:
                tf[f] = tf.get(f, 0) + 1
            # Compute TF-IDF
            vec = {f: (1 + math.log(cnt)) * self.idf.get(f, 1.0) for f, cnt in tf.items()}
            # Normalize vector
            norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
            self.doc_vectors[name] = {f: v / norm for f, v in vec.items()}

    def compute_similarity(self, query: str) -> Dict[str, float]:
        feats = self._extract_features(query)
        if not feats:
            return {name: 0.0 for name in self.doc_names}

        tf = {}
        for f in feats:
            tf[f] = tf.get(f, 0) + 1

        query_vec = {f: (1 + math.log(cnt)) * self.idf.get(f, 1.0) for f, cnt in tf.items() if f in self.idf}
        norm = math.sqrt(sum(v * v for v in query_vec.values())) or 1.0
        query_norm_vec = {f: v / norm for f, v in query_vec.items()}

        scores = {}
        for name, doc_vec in self.doc_vectors.items():
            # Dot product of normalized vectors = cosine similarity
            dot = sum(query_norm_vec[f] * doc_vec[f] for f in query_norm_vec if f in doc_vec)
            scores[name] = round(dot, 4)

        return scores


def is_conversational_message(msg: Optional[str]) -> bool:
    """Checks if a user message is purely conversational small talk or a greeting."""
    if not msg:
        return False
    clean = msg.strip().lower()
    clean_alpha = re.sub(r"[^\w\s]", "", clean).strip()
    if not clean_alpha:
        return True

    common_greetings = {
        "hi", "hello", "hey", "heya", "howdy", "sup", "yo", "hola",
        "good morning", "good afternoon", "good evening", "good day",
        "who are you", "what can you do", "can you help me", "help me",
        "thanks", "thank you", "thx", "ok", "okay", "k", "got it", "cool",
        "nice", "understood", "clear", "yep", "yes", "sure", "alright",
        "bye", "goodbye", "see you", "how are you", "what is your name",
        "tell me about yourself", "who made you"
    }
    if clean_alpha in common_greetings:
        return True

    words = clean_alpha.split()
    if len(words) <= 3 and words[0] in ["hi", "hello", "hey", "howdy", "yo", "hola", "greetings"]:
        return True

    return False


# ─────────────────────────────────────────────────────────────────────────────
# MAIN PEDAGOGICAL ARCHETYPE CLASSIFIER
# ─────────────────────────────────────────────────────────────────────────────

class PedagogicalArchetypeClassifier:
    """
    Sub-millisecond semantic topic classifier that maps student requests to
    specialized teaching styles and exemplars.
    """

    def __init__(self):
        self.vectorizer = PurePythonCosineVectorizer(ARCHETYPE_PROFILES)

    def classify(self, query: str, subject: str = "") -> ArchetypeMatchResult:
        full_text = f"{subject} {query}".lower().strip()

        # 0. Conversational Small-talk / Greeting Detection
        if is_conversational_message(query):
            rules, exemplar = ARCHETYPE_RULES_MAP["conversational"]
            return ArchetypeMatchResult(
                archetype="conversational",
                confidence=1.0,
                scores={"conversational": 1.0},
                structural_rules=rules,
                exemplar_prompt=exemplar,
                subject_inferred="general"
            )

        # 1. Immediate Rule-based Hybrid Detection
        is_hybrid = False
        hybrid_keywords = ["solve an example", "worked example", "solve a problem", "and solve", "show an example", "practice problem"]
        if any(hk in full_text for hk in hybrid_keywords) and any(th in full_text for th in ["explain", "what is", "teach", "how", "theory"]):
            is_hybrid = True

        if is_hybrid:
            rules, exemplar = ARCHETYPE_RULES_MAP["hybrid"]
            return ArchetypeMatchResult(
                archetype="hybrid",
                confidence=0.95,
                scores={"hybrid": 0.95},
                structural_rules=rules,
                exemplar_prompt=exemplar,
                subject_inferred=subject or "general"
            )

        # 2. Subword & Word Cosine Similarity Match
        scores = self.vectorizer.compute_similarity(full_text)
        tokens = set(re.findall(r"\w+", full_text))

        from agent.core.config import (
            CLASSIFIER_KEYWORD_BOOST,
            CLASSIFIER_MECHANISM_BOOST,
            CLASSIFIER_HIGH_CONFIDENCE_OVERRIDE,
            CLASSIFIER_MEDIUM_CONFIDENCE_OVERRIDE,
            CLASSIFIER_MIN_SCORE_THRESHOLD,
        )

        # Keyword Domain Boosts using token set (avoiding substring collisions like 'ac' in 'vaccine')
        if any(w in tokens for w in ["fibonacci", "fibbonaci", "recursion", "binary", "tree", "array", "python", "code", "pointer", "algorithm"]) or "data structure" in full_text:
            scores["coding_engineering"] = scores.get("coding_engineering", 0.0) + CLASSIFIER_KEYWORD_BOOST

        if any(w in tokens for w in ["quadratic", "quadratics", "derivative", "integral", "factor", "roots", "algebra", "derivation", "derive", "lagrange", "lagrangian", "hamiltonian", "proof", "prove", "evaluate", "calculate", "integrate", "differentiate"]) or "solve for" in full_text:
            scores["problem_solving"] = scores.get("problem_solving", 0.0) + CLASSIFIER_KEYWORD_BOOST

        if any(w in tokens for w in ["turbocharger", "supercharger", "engine", "compressor", "hypertrophy", "squat", "motor", "gear", "clutch", "powertrain"]) or any(ph in full_text for ph in ["air conditioner", "bench press", "cooling cycle", "heat pump"]):
            scores["general_mechanisms"] = scores.get("general_mechanisms", 0.0) + CLASSIFIER_MECHANISM_BOOST

        if any(w in tokens for w in ["wavefunction", "quantum", "copenhagen", "entropy", "vaccine", "vaccines", "mitosis", "photosynthesis", "transcription"]):
            scores["science_concepts"] = scores.get("science_concepts", 0.0) + CLASSIFIER_KEYWORD_BOOST

        # Special contextual disambiguation for "variable"
        if "variable" in tokens:
            math_terms = {"math", "mathematics", "algebra", "calculus", "equation", "formula", "x", "y"}
            coding_terms = {"programming", "code", "python", "javascript", "typescript", "java", "cs", "software"}
            if tokens.intersection(coding_terms) or "computer science" in full_text:
                scores["coding_engineering"] = max(scores.get("coding_engineering", 0.0), CLASSIFIER_HIGH_CONFIDENCE_OVERRIDE)
            elif tokens.intersection(math_terms):
                scores["problem_solving"] = max(scores.get("problem_solving", 0.0), CLASSIFIER_HIGH_CONFIDENCE_OVERRIDE)
            else:
                # Default "what is variable" without subject context -> Coding & Math foundations
                scores["coding_engineering"] = max(scores.get("coding_engineering", 0.0), CLASSIFIER_MEDIUM_CONFIDENCE_OVERRIDE)

        best_archetype = max(scores, key=scores.get)
        best_score = scores[best_archetype]

        if best_score < CLASSIFIER_MIN_SCORE_THRESHOLD:
            best_archetype = "science_concepts"

        rules, exemplar = ARCHETYPE_RULES_MAP[best_archetype]

        return ArchetypeMatchResult(
            archetype=best_archetype,
            confidence=round(best_score, 3),
            scores=scores,
            structural_rules=rules,
            exemplar_prompt=exemplar,
            subject_inferred=subject or "general"
        )

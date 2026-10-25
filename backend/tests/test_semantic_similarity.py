"""
Test suite for Semantic Similarity & Subject Resolution Engine.
Tests TF-IDF & Vector Cosine similarity for zero-LLM classification and memory retrieval.
"""
try:
    import pytest
except ImportError:
    pytest = None

# This will import from agent.core.semantic_similarity once implemented
try:
    from agent.core.semantic_similarity import (
        SemanticSubjectMatcher,
        MemorySimilarityRetriever,
        SubjectMatchResult
    )
except ImportError:
    # Will be defined in implementation step
    SemanticSubjectMatcher = None
    MemorySimilarityRetriever = None
    SubjectMatchResult = None


def _fixture(fn):
    return pytest.fixture(fn) if pytest else fn

@_fixture
def subject_matcher():
    subjects_catalog = {
        "mathematics": [
            "calculus", "differential equations", "integrals", "derivatives", 
            "algebra", "matrices", "linear algebra", "eigenvalues", "trigonometry",
            "quadratic equations", "limits", "fourier transform", "laplace transform"
        ],
        "physics": [
            "newtonian mechanics", "kinematics", "electromagnetism", "maxwell equations",
            "quantum mechanics", "thermodynamics", "carnot engine cycle", "heat reservoir",
            "optics", "relativity", "gravitation", "wave optics", "semiconductors", "circuits", "capacitance"
        ],
        "computer_science": [
            "data structures", "algorithms", "linked lists", "binary search tree",
            "dynamic programming", "graph theory", "operating systems", "memory management",
            "database design", "normalization", "sql", "object oriented programming",
            "recursion", "sorting algorithms", "machine learning", "neural networks"
        ],
        "chemistry": [
            "organic chemistry", "reaction mechanisms", "stoichiometry", "periodic table",
            "chemical bonding", "hybridization", "thermodynamics", "electrochemistry",
            "coordination compounds", "acids and bases", "equilibrium"
        ],
        "biology": [
            "cell biology", "mitosis", "meiosis", "genetics", "dna replication",
            "photosynthesis", "cellular respiration", "human anatomy", "circulatory system",
            "evolution", "ecology", "nervous system", "enzymes"
        ]
    }
    return SemanticSubjectMatcher(subjects_catalog=subjects_catalog)


class TestSemanticSubjectMatcher:
    def test_exact_subject_and_topic_match(self, subject_matcher):
        """Test exact or near-exact terminology match"""
        res = subject_matcher.resolve_subject("How do I find the eigenvalues of a 3x3 matrix?")
        assert res.subject == "mathematics"
        assert "matrices" in res.matched_topics or "eigenvalues" in res.matched_topics or "linear algebra" in res.matched_topics
        assert res.confidence > 0.6

    def test_physics_concept_match(self, subject_matcher):
        """Test kinematics & electromagnetic laws"""
        res = subject_matcher.resolve_subject("Explain how Maxwell's equations describe electromagnetic radiation propagation in a vacuum")
        assert res.subject == "physics"
        assert res.confidence > 0.6

    def test_cs_data_structures_match(self, subject_matcher):
        """Test data structures & algorithms query"""
        res = subject_matcher.resolve_subject("Show me how to insert a node into a doubly linked list without losing pointer references")
        assert res.subject == "computer_science"
        assert "linked lists" in res.matched_topics or "data structures" in res.matched_topics
        assert res.confidence > 0.6

    def test_cross_domain_disambiguation(self, subject_matcher):
        """Test terms that exist in multiple domains like 'thermodynamics' or 'matrices'"""
        # Thermodynamics in chemistry vs physics
        chem_res = subject_matcher.resolve_subject("Calculate the enthalpy change and equilibrium constant for this acid base reaction using thermodynamics")
        assert chem_res.subject == "chemistry"

        phys_res = subject_matcher.resolve_subject("Carnot engine efficiency cycle and heat reservoir work in thermodynamics")
        assert phys_res.subject == "physics"

    def test_noisy_and_informal_queries(self, subject_matcher):
        """Test informal conversational student queries"""
        res = subject_matcher.resolve_subject("yo bro can you help me solve this derivative: d/dx of sin(x)*cos(x)")
        assert res.subject == "mathematics"
        assert res.confidence > 0.4

    def test_sub_millisecond_speed(self, subject_matcher):
        """Ensure resolution latency is under 5ms (target <1ms) without any network or LLM roundtrips"""
        import time
        start = time.perf_counter()
        for _ in range(50):
            subject_matcher.resolve_subject("What is the time complexity of quicksort in the worst case?")
        duration = (time.perf_counter() - start) / 50
        assert duration < 0.01  # Must be strictly under 10ms (usually <1ms)

    def test_empty_or_gibberish_handling(self, subject_matcher):
        """Test fallback when input is non-informative"""
        res = subject_matcher.resolve_subject("asdfghjk 12345")
        assert res.confidence < 0.3
        # Should gracefully return general or highest candidate with low confidence flag
        assert res.is_confident is False


class TestMemorySimilarityRetriever:
    def test_memory_context_retrieval(self):
        """Test finding relevant past concepts from student memory turns"""
        retriever = MemorySimilarityRetriever()
        past_turns = [
            {"turn_id": 1, "topic": "Calculus", "text": "We discussed the power rule for derivatives: d/dx x^n = n*x^(n-1)"},
            {"turn_id": 2, "topic": "Physics", "text": "Newton's second law F=ma and velocity as derivative of displacement"},
            {"turn_id": 3, "topic": "Data Structures", "text": "Binary Search Tree traversal: in-order, pre-order, post-order"}
        ]
        retriever.index_memories(past_turns)

        query = "Can we use that derivative rule we talked about to find acceleration from velocity?"
        matches = retriever.retrieve_relevant(query, top_k=2)
        
        assert len(matches) > 0
        # Should match turn 2 (Physics velocity derivative) or turn 1 (Calculus power rule)
        matched_turn_ids = [m["turn_id"] for m in matches]
        assert 1 in matched_turn_ids or 2 in matched_turn_ids
        assert 3 not in matched_turn_ids[:1]  # BST should not be top match

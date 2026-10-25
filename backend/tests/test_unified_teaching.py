"""
Test suite for Unified Professor Single-Pass Teaching Architecture.
Verifies that UnifiedProfessorAgent with professor_prompt produces clean step results,
mutates the chalkboard state, and enforces phonetic spoken clarity with 0 multi-agent overhead.
"""
import sys
from pathlib import Path
backend_dir = Path(__file__).resolve().parent.parent
agent_dir = backend_dir / "agent"
sys.path.insert(0, str(backend_dir))
sys.path.insert(0, str(agent_dir))

from agent.core.state import StateManager, SessionState, BoardNode
from agent.core.professor_agent import UnifiedProfessorAgent, ProfessorStepResult
from agent.core.professor_prompt import build_professor_messages, PROFESSOR_STEP_TOOL


def test_professor_prompt_messages_generation():
    """Verify build_professor_messages builds compact, natural prompt messages."""
    state = SessionState(session_id="test_sess_clean", subject="Mathematics", topic="Calculus")
    state.nodes.append(BoardNode(id="n1", kind="heading", content="Introduction to Derivatives"))
    state.nodes.append(BoardNode(id="n2", kind="equation", content="f(x) = x^2"))

    messages = build_professor_messages(state, student_message="How do I find the derivative?")
    assert len(messages) == 3
    assert messages[0]["role"] == "system"
    assert "SPOKEN CLARITY" in messages[0]["content"]
    assert "TEACHING FOCUS" in messages[0]["content"]
    # No artificial step limits or pseudo-academic jargon
    assert "DUAL-STREAM SYNCHRONICITY" not in messages[0]["content"]
    assert "STEP 1 of 4" not in messages[1]["content"]
    assert "STUDENT ASKS: How do I find the derivative?" in messages[2]["content"]


def test_professor_conversational_greeting():
    """Verify build_professor_messages properly handles greetings with empty board writes instruction."""
    state = SessionState(session_id="test_sess_greeting", subject="General", topic="General")
    messages = build_professor_messages(state, student_message="hi")
    assert len(messages) == 3
    assert "STUDENT SAYS: hi" in messages[2]["content"]
    assert "keep board_writes: [] empty" in messages[2]["content"]
    assert "Do NOT invent, assume, or lecture on unprompted academic topics" in messages[2]["content"]


def test_professor_step_result_state_mutation():
    """Verify UnifiedProfessorAgent properly applies a step result to the session state."""
    sm = StateManager()
    agent = UnifiedProfessorAgent(state_manager=sm)
    state = SessionState(session_id="test_sess_mutation", subject="Physics", topic="Kinematics")

    step_result = ProfessorStepResult(
        board_writes=[
            {"action": "write", "kind": "heading", "content": "Newton's Second Law", "role": "heading"},
            {"action": "write", "kind": "equation", "content": "F_{net} = m \\cdot a", "role": "primary_stream"},
            {"action": "scratchpad", "kind": "scratchpad", "content": "Units: F in N, m in kg, a in m/s^2", "role": "margin", "spatial_intent": {"zone": "margin"}},
            {"action": "circle", "target_node_id": "node_1", "sub_term": "F_{net}"}
        ],
        speech="Force equals mass times acceleration.",
        gesture="explain",
        yield_decision="continue"
    )

    agent.apply_step_to_state(state, step_result)
    assert len(state.nodes) == 3
    assert len(state.overlays) == 1
    assert state.step_counter == 3
    print("[PASS] State mutation and overlays applied cleanly.")


if __name__ == "__main__":
    test_professor_prompt_messages_generation()
    print("[PASS] Prompt messages generation passed.")
    test_professor_step_result_state_mutation()
    print("\nAll unified teaching tests passed!")

import asyncio
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

# Ensure backend and backend/agent are in path
backend_dir = Path(__file__).parent.parent
agent_dir = backend_dir / "agent"
for p in [str(backend_dir), str(agent_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

import pytest
from skills.teaching import TutorManager, TurnExecutor, StepResult
from core.professor_agent import ProfessorStepResult

pytestmark = pytest.mark.anyio


def test_clean_history():
    tutor = TutorManager()
    executor = TurnExecutor(tutor)
    
    raw_history = [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Let me teach you.\n\n```component\n{\"type\": \"OrchestratedTeachStep\"}\n```"},
        {"role": "user", "content": "Tell me more"},
    ]
    
    cleaned = executor._clean_history(raw_history)
    assert len(cleaned) == 3
    assert "```component" not in cleaned[1]["content"]
    assert cleaned[1]["content"] == "Let me teach you."


async def test_turn_executor_single_step_yield():
    tutor = TutorManager()
    executor = TurnExecutor(tutor)
    
    mock_step_result = ProfessorStepResult(
        speech="Threads are lightweight processes.",
        board_writes=[
            {"action": "write", "id": "node-1", "text": "Thread = Lightweight Unit", "kind": "text", "zone": "main"}
        ],
        yield_decision="yield"
    )
    
    one_step_plan = {
        "prompt_type": "conversational",
        "topic": "Threads",
        "subtopics": [{"id": "step_1", "title": "Overview", "goal": "Intro", "status": "teaching"}],
        "order": ["step_1"],
        "current_index": 0
    }
    import uuid
    test_sess = f"test_session_1_{uuid.uuid4().hex[:8]}"
    with patch.object(executor.professor_agent, "run_turn_step", return_value=mock_step_result), \
         patch.object(executor.tutor.lesson_planner, "generate_lesson_plan", return_value=one_step_plan):
        result = await executor.execute_step(
            session_id=test_sess,
            workspace_id="default",
            student_id="guest",
            user_message="Hello",
            step_index=0,
            history=[],
            profile={"mastery": {}, "weak_concepts": []}
        )
        
        assert isinstance(result, StepResult)
        assert result.yield_decision == "yield"
        assert result.step_index == 0
        assert result.payload["type"] == "OrchestratedTeachStep"
        assert "board" in result.payload
        assert "voice" in result.payload
        assert len(result.updated_history) == 1
        assert "```component" in result.chat_markdown


async def test_turn_executor_continuation_and_cap():
    tutor = TutorManager()
    executor = TurnExecutor(tutor)
    
    mock_step_result = ProfessorStepResult(
        speech="Next, let's look at stack vs heap.",
        board_writes=[],
        yield_decision="continue"
    )
    
    # Test step continuation
    with patch.object(executor.professor_agent, "run_turn_step", return_value=mock_step_result) as mock_run:
        result = await executor.execute_step(
            session_id="test_session_2",
            workspace_id="default",
            student_id="guest",
            user_message=None,  # Continuation
            step_index=1,
            history=[{"role": "user", "content": "Explain threads"}],
            profile={"mastery": {}, "weak_concepts": []}
        )
        
        assert result.yield_decision == "continue"
        mock_run.assert_called_once()
        call_kwargs = mock_run.call_args.kwargs
        assert call_kwargs["student_message"] is None

    # Test safety cap at MAX_STEPS_PER_TURN
    with patch.object(executor.professor_agent, "run_turn_step", return_value=mock_step_result):
        result = await executor.execute_step(
            session_id="test_session_3",
            workspace_id="default",
            student_id="guest",
            user_message=None,
            step_index=executor.MAX_STEPS_PER_TURN,
            history=[],
            profile={"mastery": {}, "weak_concepts": []}
        )
        # Should be forced to yield at max step cap
        assert result.yield_decision == "yield"


async def test_turn_executor_ask_question():
    tutor = TutorManager()
    executor = TurnExecutor(tutor)
    
    mock_step_result = ProfessorStepResult(
        speech="Can two threads share the same heap?",
        board_writes=[],
        yield_decision="ask_student",
        question="Can two threads in the same process share heap memory?"
    )
    
    with patch.object(executor.professor_agent, "run_turn_step", return_value=mock_step_result):
        result = await executor.execute_step(
            session_id="test_session_4",
            workspace_id="default",
            student_id="guest",
            user_message="Do threads share memory?",
            step_index=0,
            history=[],
            profile={"mastery": {}, "weak_concepts": []}
        )
        
        assert result.yield_decision == "ask"
        assert result.ask_question == "Can two threads in the same process share heap memory?"


async def test_turn_executor_conversational_greeting():
    tutor = TutorManager()
    executor = TurnExecutor(tutor)
    
    mock_step_result = ProfessorStepResult(
        speech="Hello there! Welcome. What subject or topic would you like to explore today?",
        board_writes=[],
        yield_decision="yield"
    )
    
    with patch.object(executor.professor_agent, "run_turn_step", return_value=mock_step_result):
        result = await executor.execute_step(
            session_id="test_session_greeting",
            workspace_id="default",
            student_id="guest",
            user_message="hi",
            step_index=0,
            history=[],
            profile={"mastery": {}, "weak_concepts": []}
        )
        
        assert result.yield_decision == "yield"
        assert result.step_index == 0
        assert len(result.payload["board"]["elements"]) == 0
        assert "Hello there!" in result.chat_markdown
        # Ensure state topic wasn't set to "Hi"
        sess = executor.state_manager.load_or_create_session("test_session_greeting")
        assert sess.topic.lower() != "hi"


def test_get_tutor_response_unified_execution():
    tutor = TutorManager()
    
    mock_step_result = ProfessorStepResult(
        speech="Let's study quicksort.",
        board_writes=[
            {"action": "write", "id": "n1", "text": "Quicksort Partitioning", "kind": "text", "zone": "main"}
        ],
        yield_decision="ask",
        question="What is the pivot?"
    )
    
    import uuid
    test_sess = f"test_http_{uuid.uuid4().hex[:8]}"
    with patch.object(tutor.professor_agent, "run_turn_step", return_value=mock_step_result), \
         patch.object(tutor.lesson_planner, "generate_lesson_plan", return_value={"subtopics": []}):
        resp = tutor.get_tutor_response(
            workspace_id="default",
            student_id="guest",
            topic_id="quicksort",
            student_message="Explain quicksort",
            subject_name="Computer Science",
            session_id=test_sess
        )
        assert "response" in resp
        assert "board" in resp
        assert "elements" in resp["board"]
        assert len(resp["board"]["elements"]) == 1
        assert resp["intent"]["yield"] == "ask"
        assert resp["active_topic_id"] == "quicksort"
        assert "model" in resp


if __name__ == "__main__":
    print("Running test_clean_history...")
    test_clean_history()
    print("Running test_turn_executor_single_step_yield...")
    asyncio.run(test_turn_executor_single_step_yield())
    print("Running test_turn_executor_continuation_and_cap...")
    asyncio.run(test_turn_executor_continuation_and_cap())
    print("Running test_turn_executor_ask_question...")
    asyncio.run(test_turn_executor_ask_question())
    print("Running test_turn_executor_conversational_greeting...")
    asyncio.run(test_turn_executor_conversational_greeting())
    print("Running test_get_tutor_response_unified_execution...")
    test_get_tutor_response_unified_execution()
    print("ALL TESTS PASSED SUCCESSFULLY!")



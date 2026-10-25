"""
Agent definitions — Base agent class and specialized agents.

All system prompts use triple-quoted strings. BaseAgent.run() builds a
proper messages[] array and supports the TaskExecutionEngine for managed sessions.
"""

import json
import re
import textwrap
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger("agent_orchestration")
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    logger.addHandler(ch)


from .prompt_manager import cached_run_llm
from .prompt_manager import (
    CURRICULUM_AGENT_PROMPT, RESEARCH_AGENT_PROMPT,
    ANIMATION_AGENT_PROMPT, PROJECT_MENTOR_AGENT_PROMPT, MEMORY_AGENT_PROMPT,
    PromptBuilder, ASSESSMENT_AGENT_PROMPT, STUDENT_MODEL_AGENT_PROMPT,
    VISUAL_SEARCH_AGENT_PROMPT
)

from .task_engine import inject_cache_breakpoints



CURRICULUM_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "build_curriculum",
            "description": "Builds the structured curriculum knowledge graph with topics and prerequisites.",
            "parameters": {
                "type": "object",
                "properties": {
                    "topics": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string", "description": "Unique stable ID for this topic (e.g., 'intro_variables')"},
                                "name": {"type": "string", "description": "Clear name of the topic"},
                                "description": {"type": "string", "description": "Brief explanation of what the topic covers"},
                                "prerequisites": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "description": "List of topic IDs that are prerequisites for this topic"
                                }
                            },
                            "required": ["id", "name", "description", "prerequisites"]
                        }
                    }
                },
                "required": ["topics"]
            }
        }
    }
]

RESEARCH_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "build_knowledge_package",
            "description": "Constructs a comprehensive topic knowledge package for teaching.",
            "parameters": {
                "type": "object",
                "properties": {
                    "definitions": {"type": "string", "description": "Clear and concise core explanation/definitions of the topic."},
                    "visual_explanations": {"type": "string", "description": "Visual explanations, analogies, or ASCII diagrams."},
                    "examples": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "problem": {"type": "string", "description": "The problem or exercise description."},
                                "solution": {"type": "string", "description": "Step-by-step solution to the problem."}
                            },
                            "required": ["problem", "solution"]
                        },
                        "description": "Step-by-step worked examples/exercises with answers."
                    },
                    "misconceptions": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "misconception": {"type": "string", "description": "What students commonly get wrong."},
                                "correction": {"type": "string", "description": "How to correct this misconception."}
                            },
                            "required": ["misconception", "correction"]
                        },
                        "description": "Common student misconceptions and their corrections."
                    },
                    "applications": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Real-world applications or technical interview questions."
                    }
                },
                "required": ["definitions", "visual_explanations", "examples", "misconceptions", "applications"]
            }
        }
    }
]

ASSESSMENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "generate_assessment",
            "description": "Generates a customized adaptive micro-assessment with exactly 3 questions.",
            "parameters": {
                "type": "object",
                "properties": {
                    "questions": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string", "description": "Unique question ID (e.g., 'q1', 'q2', 'q3')"},
                                "type": {"type": "string", "enum": ["conceptual", "application", "reasoning"], "description": "The category/type of the question"},
                                "question": {"type": "string", "description": "The question text"},
                                "options": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "description": "Four multiple choice options"
                                },
                                "correct_answer": {"type": "string", "description": "The exact option string that is correct"},
                                "explanation": {"type": "string", "description": "Detailed explanation of why this option is correct"}
                            },
                            "required": ["id", "type", "question", "options", "correct_answer", "explanation"]
                        }
                    }
                },
                "required": ["questions"]
            }
        }
    }
]

VISUAL_SEARCH_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_images",
            "description": "Searches for images and returns their metadata and URLs.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search query (e.g. 'Mitochondria diagram')"}
                },
                "required": ["query"]
            }
        }
    }
]

CHECK_STATUS_TOOL = {
    "type": "function",
    "function": {
        "name": "check_status",
        "description": "Checks the current operations and status of all other agents (e.g., what the Board Agent is currently drawing, or what the Voice Agent is speaking). Call this to gain situational awareness before proceeding if you need to sync with them.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    }
}

ANIMATION_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "generate_animations",
            "description": "Generates a list of basic animations."
        }
    }
]

STUDENT_MODEL_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "evaluate_submission",
            "description": "Evaluates a student's assessment submission, determining the updated mastery score and identifying misconceptions.",
            "parameters": {
                "type": "object",
                "properties": {
                    "updated_mastery": {"type": "integer", "description": "New mastery score for the student (0 to 100)."},
                    "reasoning": {"type": "string", "description": "Reasoning explaining why this mastery score was given based on correct/incorrect answers."},
                    "misconceptions_found": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of specific misconceptions identified during this assessment."
                    }
                },
                "required": ["updated_mastery", "reasoning", "misconceptions_found"]
            }
        }
    }
]


class BaseAgent:
    """Base class for all agents in the Learning Operating System."""

    def __init__(self, name: str, system_prompt: str):
        from .prompt_manager import GLOBAL_PERSONA
        self.name = name
        self.system_prompt = f"{GLOBAL_PERSONA}\n\nAgent Rules:\n{system_prompt}"

    def run(
        self,
        user_message: str,
        history: Optional[List[Dict[str, str]]] = None,
        tools: Optional[List[dict]] = None,
    ) -> str | dict:
        """
        Runs the agent with a proper messages[] array.

        Builds:
          [system prompt] → [history messages] → [user message]

        Applies cache breakpoints before sending to the LLM.
        """
        messages = []

        # 1. System prompt
        messages.append({"role": "system", "content": self.system_prompt})

        # 2. Conversation history
        if history:
            for msg in history:
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", ""),
                })

        # 3. Current user message
        messages.append({"role": "user", "content": user_message})

        # Apply cache breakpoints
        messages = inject_cache_breakpoints(messages)

        logger.info(f"Agent '{self.name}' is being called with {len(messages)} messages.")
        
        try:
            response = cached_run_llm(messages=messages, tools=tools)
            logger.info(f"Agent '{self.name}' completed call successfully.")
            if isinstance(response, dict):
                return response
            return response.strip()
        except Exception as e:
            return f"Error running agent {self.name}: {str(e)}"

    def run_json(
        self,
        user_message: str,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> Any:
        """Runs the agent and parses the response as JSON (uses tool calling if self.tools is set)."""
        if hasattr(self, "tools") and self.tools:
            tool_name = self.tools[0]["function"]["name"]
            messages = [
                {"role": "system", "content": self.system_prompt},
            ]
            if history:
                for msg in history:
                    messages.append({
                        "role": msg.get("role", "user"),
                        "content": msg.get("content", ""),
                    })
            messages.append({"role": "user", "content": user_message})
            messages.append({"role": "user", "content": f"You MUST call the `{tool_name}` tool now. Do not return plain text."})

            # Apply cache control breakpoints
            messages = inject_cache_breakpoints(messages)

            logger.info(f"Agent '{self.name}' is being called (JSON mode) with {len(messages)} messages. Forcing tool: {tool_name}")

            try:
                response = cached_run_llm(
                    messages=messages,
                    tools=self.tools,
                    tool_choice={"type": "function", "function": {"name": tool_name}}
                )
                logger.info(f"Agent '{self.name}' (JSON mode) completed call.")

                if isinstance(response, dict) and response.get("tool_calls"):
                    try:
                        args = response["tool_calls"][0]["function"]["arguments"]
                        if isinstance(args, str):
                            args = json.loads(args)
                        logger.info(f"Agent '{self.name}' parsed arguments successfully.")
                        return args
                    except Exception as e:
                        logger.error(f"Agent '{self.name}' failed to parse tool call arguments: {str(e)}")
                        return {
                            "error": f"Failed to parse tool call arguments: {str(e)}",
                            "raw_response": response
                        }
                logger.warning(f"Agent '{self.name}' (JSON mode) returned no tool call.")
                return {"error": f"No tool call returned for {self.name}", "raw_response": response}
            except Exception as e:
                return {"error": f"Error during tool-based run: {str(e)}"}

        res_str = self.run(user_message, history)

        # Clean markdown code block formatting if present
        cleaned = res_str.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\n", "", cleaned)
            cleaned = re.sub(r"\n```$", "", cleaned)
            cleaned = cleaned.strip()

        try:
            return json.loads(cleaned)
        except Exception as e:
            # Try to extract anything between { and } or [ and ] as a fallback
            try:
                match = re.search(r"(\{.*\}|\[.*\])", cleaned, re.DOTALL)
                if match:
                    return json.loads(match.group(1))
            except Exception:
                pass
            return {
                "error": "Failed to parse JSON response",
                "raw_response": res_str,
                "parse_error": str(e),
            }


class CurriculumAgent(BaseAgent):
    def __init__(self):
        super().__init__("Curriculum Agent", CURRICULUM_AGENT_PROMPT)
        self.tools = CURRICULUM_TOOLS


class ResearchAgent(BaseAgent):
    def __init__(self):
        super().__init__("Research Agent", RESEARCH_AGENT_PROMPT)
        self.tools = RESEARCH_TOOLS


class AssessmentAgent(BaseAgent):
    def __init__(self):
        super().__init__("Assessment Agent", ASSESSMENT_AGENT_PROMPT)
        self.tools = ASSESSMENT_TOOLS


class AnimationAgent(BaseAgent):
    def __init__(self):
        super().__init__("Animation Agent", ANIMATION_AGENT_PROMPT)
        self.tools = ANIMATION_TOOLS


class VisualSearchAgent(BaseAgent):
    def __init__(self):
        super().__init__("Visual Search Agent", VISUAL_SEARCH_AGENT_PROMPT)
        self.tools = VISUAL_SEARCH_TOOLS


class ProjectMentorAgent(BaseAgent):
    def __init__(self):
        super().__init__("Project Mentor Agent", PROJECT_MENTOR_AGENT_PROMPT)


class MemoryAgent(BaseAgent):
    def __init__(self):
        super().__init__("Memory Agent", MEMORY_AGENT_PROMPT)
        self.tools = [
            {
                "type": "function",
                "function": {
                    "name": "update_memory",
                    "description": "Summarizes the student's profile and memory based on the latest batch of interactions.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "mastery_updates": {
                                "type": "object",
                                "additionalProperties": {"type": "integer"},
                                "description": "Map of topic IDs to mastery delta (e.g., {'linked_lists': 10})"
                            },
                            "weak_concepts": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "List of weak concepts identified in this turn."
                            },
                            "interests": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Genuine personal extracurricular hobbies (e.g. 'chess', 'piano'). Never include academic curriculum topics."
                            },
                            "learning_style": {
                                "type": "string",
                                "description": "Detected learning style (e.g., 'visual', 'auditory', 'kinesthetic')."
                            },
                            "lesson_transcript": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "A running summary of the lesson's events (e.g. 'I am teaching abc', 'just finished x topic', 'user got abc doubt')."
                            }
                        },
                        "required": ["mastery_updates", "weak_concepts", "interests", "learning_style", "lesson_transcript"]
                    }
                }
            }
        ]
        self.tools.append(CHECK_STATUS_TOOL)
        
    def run_tool(self, user_message: str, chat_history: Optional[List[Dict[str, str]]] = None, session_id: str = None) -> dict:
        """Runs the agent and forces the update_memory tool."""
        messages = [
            {"role": "system", "content": self.system_prompt}
        ]
        if chat_history:
            messages.extend(chat_history)
            
        messages.extend([
            {"role": "user", "content": f"User Input:\n{user_message}"},
            {"role": "user", "content": "You MUST call the `update_memory` tool now. Do not return plain text."}
        ])
        
        from .task_engine import inject_cache_breakpoints
        messages = inject_cache_breakpoints(messages, session_id=session_id, max_breakpoints=3)
        
        logger.info(f"Agent '{self.name}' is being called with {len(messages)} messages. Tools available: update_memory, check_status")
        
        from .brain.llm_cloud import run_llm
        while True:
            response = run_llm(
                messages=messages,
                tools=self.tools,
                tool_choice="auto"
            )
            
            if isinstance(response, dict) and response.get("tool_calls"):
                tc = response["tool_calls"][0]
                if tc["function"]["name"] == "check_status":
                    from .task_engine import TaskMemoryManager
                    task_mem = TaskMemoryManager().load_memory(session_id)
                    status_data = task_mem.get("active_operations", {})
                    messages.append({
                        "role": "assistant",
                        "content": response.get("content", ""),
                        "tool_calls": response["tool_calls"]
                    })
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "name": "check_status",
                        "content": json.dumps(status_data)
                    })
                    continue
                else:
                    logger.info(f"Agent '{self.name}' completed call with {tc['function']['name']}.")
                    try:
                        args = tc["function"]["arguments"]
                        if isinstance(args, str):
                            args = json.loads(args)
                        return args
                    except Exception as e:
                        print("Error parsing tool call:", e)
                        
            return {
                "mastery_updates": {},
                "weak_concepts": [],
                "interests": [],
                "learning_style": "visual",
                "lesson_transcript": []
            }


class StudentModelAgent(BaseAgent):
    def __init__(self):
        super().__init__("Student Model Agent", STUDENT_MODEL_AGENT_PROMPT)
        self.tools = STUDENT_MODEL_TOOLS

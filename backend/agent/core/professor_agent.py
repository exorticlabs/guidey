"""
professor_agent.py — Unified Professor Agent.

Executes single-turn chalkboard teaching steps where:
1. LLM = professor at blackboard.
2. Output is structured tool call (professor_step).
3. Board state IS the memory.
4. Hot state is persisted to local SQLite.
5. Emits real-time step frames for WebSocket streaming.
"""
from dataclasses import dataclass, field, asdict
from typing import Dict, Any, List, Optional, Generator
import json
import uuid
import time
import re
import logging

from agent.core.state import SessionState, BoardNode, ChalkOverlay, BoardConnection, StateManager
from agent.core.professor_prompt import PROFESSOR_STEP_TOOL, build_professor_messages
from agent.core.brain.llm_cloud import run_llm

logger = logging.getLogger("professor_agent")


@dataclass
class ProfessorStepResult:
    board_writes: List[Dict[str, Any]]
    speech: str
    gesture: str = "explain"
    yield_decision: str = "continue"  # 'continue' | 'ask' | 'yield'
    question: Optional[str] = None
    raw_response: Any = None


class UnifiedProfessorAgent:
    """
    Unified Professor Agent that drives the step-by-step interactive chalkboard loop.
    """

    def __init__(self, state_manager: Optional[StateManager] = None):
        self.state_manager = state_manager or StateManager()

    def run_turn_step(
        self,
        state: SessionState,
        student_message: Optional[str] = None,
        step_index: int = 0,
        max_steps: Optional[int] = None,
        guidance: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None
    ) -> ProfessorStepResult:
        """
        Executes a single step with the LLM via tool calling.
        """
        messages = build_professor_messages(
            state=state,
            student_message=student_message,
            step_index=step_index,
            max_steps=max_steps,
            guidance=guidance,
            history=history
        )

        try:
            response = run_llm(
                messages=messages,
                tools=[PROFESSOR_STEP_TOOL],
                tool_choice={"type": "function", "function": {"name": "professor_step"}},
                max_new_tokens=2048
            )

            # Parse tool call from response
            if isinstance(response, dict) and response.get("tool_calls"):
                tc = response["tool_calls"][0]
                args = tc.get("function", {}).get("arguments", {})
                if isinstance(args, str):
                    args = json.loads(args)

                default_yield = "yield"
                return ProfessorStepResult(
                    board_writes=args.get("board_writes", []),
                    speech=args.get("speech", ""),
                    gesture=args.get("gesture", "explain"),
                    yield_decision=args.get("yield", default_yield),
                    question=args.get("question"),
                    raw_response=response
                )
            elif isinstance(response, dict) and "name" in response:
                # Direct tool response format
                args = response.get("arguments", {})
                if isinstance(args, str):
                    args = json.loads(args)
                return ProfessorStepResult(
                    board_writes=args.get("board_writes", []),
                    speech=args.get("speech", ""),
                    gesture=args.get("gesture", "explain"),
                    yield_decision=args.get("yield", "yield"),
                    question=args.get("question"),
                    raw_response=response
                )
            elif isinstance(response, str):
                # Fallback: Attempt JSON extraction or clean text wrap
                clean_speech = response
                board_writes = []
                if "{" in response and "}" in response:
                    try:
                        start = response.find("{")
                        end = response.rfind("}") + 1
                        parsed = json.loads(response[start:end])
                        if "speech" in parsed:
                            return ProfessorStepResult(
                                board_writes=parsed.get("board_writes", []),
                                speech=parsed.get("speech", ""),
                                gesture=parsed.get("gesture", "explain"),
                                yield_decision=parsed.get("yield", "yield"),
                                question=parsed.get("question"),
                                raw_response=response
                            )
                    except Exception:
                        pass

                # If pure prose string
                board_writes.append({
                    "action": "write",
                    "kind": "text",
                    "role": "primary_stream",
                    "content": clean_speech[:120]
                })
                return ProfessorStepResult(
                    board_writes=board_writes,
                    speech=clean_speech,
                    gesture="explain",
                    yield_decision="yield",
                    raw_response=response
                )

            # Universal safety fallback if response structure was unexpected
            return ProfessorStepResult(
                board_writes=[{
                    "action": "write",
                    "kind": "text",
                    "role": "primary_stream",
                    "content": "Let us continue exploring this concept."
                }],
                speech="Let us continue exploring this concept.",
                gesture="explain",
                yield_decision="yield"
            )

        except Exception as e:
            logger.error(f"[ProfessorAgent] Error running LLM step: {e}", exc_info=True)
            return ProfessorStepResult(
                board_writes=[{
                    "action": "write",
                    "kind": "text",
                    "role": "primary_stream",
                    "content": "Let us review this step carefully."
                }],
                speech="Let us review this step carefully.",
                gesture="think",
                yield_decision="yield"
            )

    @staticmethod
    def _normalize_content(raw_content: Any, kind: str = "text") -> str:
        """Safely coerce any content (str, list, dict) into clean formatted string."""
        if raw_content is None:
            return ""
        if isinstance(raw_content, str):
            return raw_content

        # Handle dictionary (e.g. table with headers & rows, or generic json)
        if isinstance(raw_content, dict):
            headers = raw_content.get("headers") or raw_content.get("columns")
            rows = raw_content.get("rows")
            if headers and isinstance(headers, list) and rows and isinstance(rows, list):
                header_line = "| " + " | ".join(str(h).strip() for h in headers) + " |"
                sep_line = "| " + " | ".join(["---"] * len(headers)) + " |"
                row_lines = [
                    "| " + " | ".join(str(c).strip() if not isinstance(c, (dict, list)) else json.dumps(c) for c in (r if isinstance(r, list) else [r])) + " |"
                    for r in rows
                ]
                return "\n".join([header_line, sep_line] + row_lines)
            return json.dumps(raw_content, indent=2)

        # Handle list
        if isinstance(raw_content, list):
            # If kind == "table" and it's a list of rows
            if kind == "table" and raw_content and all(isinstance(r, list) for r in raw_content):
                headers = raw_content[0]
                rows = raw_content[1:]
                header_line = "| " + " | ".join(str(h).strip() for h in headers) + " |"
                sep_line = "| " + " | ".join(["---"] * len(headers)) + " |"
                row_lines = [
                    "| " + " | ".join(str(c).strip() for c in r) + " |"
                    for r in rows
                ]
                return "\n".join([header_line, sep_line] + row_lines)

            # Bullet list or general list items
            lines = []
            for item in raw_content:
                if isinstance(item, (dict, list)):
                    lines.append(json.dumps(item))
                else:
                    item_str = str(item).strip()
                    if kind == "bullet_list" and not item_str.startswith(("-", "*", "•")) and not re.match(r"^\d+\.", item_str):
                        lines.append(f"- {item_str}")
                    else:
                        lines.append(item_str)
            return "\n".join(lines)

        return str(raw_content)

    def apply_step_to_state(
        self,
        state: SessionState,
        step: ProfessorStepResult,
        step_index: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Applies board_writes from ProfessorStepResult to the session state.
        Returns the list of modified/new node dicts for the frontend.
        """
        modified_nodes = []

        for write in step.board_writes:
            action = write.get("action", "write")

            if action == "write":
                node_id = f"node_{uuid.uuid4().hex[:8]}"
                kind = write.get("kind", "text")
                raw_content = write.get("content")
                if raw_content is None:
                    raw_content = write.get("text", "")
                content = self._normalize_content(raw_content, kind=kind)
                role = write.get("role", "primary_stream")

                # Step numbering: explicit if present, else fallback to current step_index
                step_num = None
                step_match = re.match(r"^Step\s*(\d+)", content.strip(), re.IGNORECASE)
                if step_match:
                    step_num = int(step_match.group(1))
                else:
                    step_num = step_index

                # Unified open chalkboard canvas: all nodes belong to main board area
                spatial_intent = write.get("spatial_intent")
                zone = "main"

                # Auto-chain vertical progression if spatial_intent missing
                if spatial_intent is None and state.nodes:
                    spatial_intent = {"rel": "below", "target_id": state.nodes[-1].id}

                node = BoardNode(
                    id=node_id,
                    kind=kind,
                    content=content,
                    role=role if role != "margin" else "primary_stream",
                    zone="main",
                    step_num=step_num,
                    spatial_intent=spatial_intent
                )
                state.nodes.append(node)
                state.step_counter += 1
                modified_nodes.append(asdict(node))

            elif action == "scratchpad":
                node_id = f"scratch_{uuid.uuid4().hex[:8]}"
                content = self._normalize_content(write.get("content", ""), kind="scratchpad")
                spatial_intent = write.get("spatial_intent")
                if spatial_intent is None and state.nodes:
                    spatial_intent = {"rel": "below", "target_id": state.nodes[-1].id}

                node = BoardNode(
                    id=node_id,
                    kind="scratchpad",
                    content=content,
                    role="primary_stream",
                    zone="main",
                    step_num=step_index,
                    spatial_intent=spatial_intent
                )
                state.nodes.append(node)
                state.step_counter += 1
                modified_nodes.append(asdict(node))

            elif action in ["circle", "encircle"]:
                target_id = write.get("target_node_id", "")
                sub_term = write.get("sub_term", "")
                if not target_id or not any(n.id == target_id for n in state.nodes):
                    target_id = self._resolve_target_node_id(state.nodes, sub_term)
                if target_id:
                    overlay = ChalkOverlay(
                        id=f"ov_{uuid.uuid4().hex[:6]}",
                        target_node_id=target_id,
                        overlay_type="encircle",
                        sub_term=sub_term,
                        color="chalk-yellow"
                    )
                    state.overlays.append(overlay)

            elif action in ["cancel", "strikethrough"]:
                target_id = write.get("target_node_id", "")
                sub_term = write.get("sub_term", "")
                if not target_id or not any(n.id == target_id for n in state.nodes):
                    target_id = self._resolve_target_node_id(state.nodes, sub_term)
                if target_id:
                    overlay = ChalkOverlay(
                        id=f"ov_{uuid.uuid4().hex[:6]}",
                        target_node_id=target_id,
                        overlay_type="strikethrough",
                        sub_term=sub_term,
                        color="chalk-red"
                    )
                    state.overlays.append(overlay)

            elif action == "box":
                target_id = write.get("target_node_id", "")
                sub_term = write.get("sub_term", "")
                if not target_id or not any(n.id == target_id for n in state.nodes):
                    target_id = self._resolve_target_node_id(state.nodes, sub_term)
                if target_id:
                    overlay = ChalkOverlay(
                        id=f"ov_{uuid.uuid4().hex[:6]}",
                        target_node_id=target_id,
                        overlay_type="box",
                        sub_term=sub_term,
                        color="chalk-cyan"
                    )
                    state.overlays.append(overlay)

            elif action == "highlight":
                target_id = write.get("target_node_id", "")
                sub_term = write.get("sub_term", "")
                if not target_id or not any(n.id == target_id for n in state.nodes):
                    target_id = self._resolve_target_node_id(state.nodes, sub_term)
                if target_id:
                    overlay = ChalkOverlay(
                        id=f"ov_{uuid.uuid4().hex[:6]}",
                        target_node_id=target_id,
                        overlay_type="highlight",
                        sub_term=sub_term,
                        color="chalk-yellow"
                    )
                    state.overlays.append(overlay)

            elif action in ["annotate", "underline"]:
                target_id = write.get("target_node_id", "")
                sub_term = write.get("sub_term", "")
                if not target_id or not any(n.id == target_id for n in state.nodes):
                    target_id = self._resolve_target_node_id(state.nodes, sub_term)
                if target_id:
                    overlay = ChalkOverlay(
                        id=f"ov_{uuid.uuid4().hex[:6]}",
                        target_node_id=target_id,
                        overlay_type="underline",
                        sub_term=sub_term,
                        color="chalk-yellow"
                    )
                    state.overlays.append(overlay)

            elif action == "erase":
                target_id = write.get("target_node_id", "")
                state.nodes = [n for n in state.nodes if n.id != target_id]
                state.overlays = [o for o in state.overlays if o.target_node_id != target_id]
                state.connections = [c for c in state.connections if c.from_id != target_id and c.to_id != target_id]

            elif action == "arrow":
                conn = BoardConnection(
                    id=f"conn_{uuid.uuid4().hex[:6]}",
                    from_id=write.get("from_node_id", ""),
                    to_id=write.get("to_node_id", ""),
                    label=write.get("arrow_label", ""),
                    style="curved_callout"
                )
                state.connections.append(conn)

        # NLP Speech Intent Fallback: Extract verbalized chalk directives if missed in tool call
        self._extract_speech_directives(state, step.speech)

        # Log event
        actions_summary = ", ".join(w.get("action", "?") for w in step.board_writes)
        state.add_event("professor", actions_summary, step.speech[:100])

        return modified_nodes

    def _resolve_target_node_id(self, nodes: List[BoardNode], sub_term: str) -> str:
        """Dynamically resolve which node on the board the professor is targeting."""
        if not nodes:
            return ""
        if sub_term:
            sub_lower = sub_term.lower().strip("$").strip()
            # 1. Look for term containment in equations or steps
            for node in reversed(nodes):
                if sub_lower in str(node.content).lower():
                    return node.id
        # 2. Fallback to the latest primary equation, step, or node
        for node in reversed(nodes):
            if node.kind in ["equation", "step", "diagram"] or node.role == "primary_stream":
                return node.id
        return nodes[-1].id

    def _extract_speech_directives(self, state: SessionState, speech: str):
        """NLP semantic fallback: detects verbalized professor actions in speech."""
        if not speech or not state.nodes:
            return

        speech_lower = speech.lower()

        # Check for verbal circle directive (e.g. "let's circle ...")
        circle_patterns = [
            r"(?:circle|encircle)\s+(?:the\s+)?([^\.\n,]+)",
            r"put\s+a\s+circle\s+around\s+([^\.\n,]+)",
        ]
        for pat in circle_patterns:
            m = re.search(pat, speech_lower)
            if m:
                target_term = m.group(1).strip()
                # Check if this target was already encircled
                if not any(o.overlay_type in ["encircle", "circle"] and o.sub_term == target_term for o in state.overlays):
                    target_id = self._resolve_target_node_id(state.nodes, target_term)
                    if target_id:
                        state.overlays.append(ChalkOverlay(
                            id=f"ov_{uuid.uuid4().hex[:6]}",
                            target_node_id=target_id,
                            overlay_type="encircle",
                            sub_term=target_term,
                            color="chalk-yellow"
                        ))
                break

        # Check for verbal cancel / strikethrough directive
        cancel_patterns = [
            r"(?:cancel|cross out|strike out|divide out)\s+(?:the\s+)?([^\.\n,]+)",
        ]
        for pat in cancel_patterns:
            m = re.search(pat, speech_lower)
            if m:
                target_term = m.group(1).strip()
                if not any(o.overlay_type in ["strikethrough", "cancel"] and o.sub_term == target_term for o in state.overlays):
                    target_id = self._resolve_target_node_id(state.nodes, target_term)
                    if target_id:
                        state.overlays.append(ChalkOverlay(
                            id=f"ov_{uuid.uuid4().hex[:6]}",
                            target_node_id=target_id,
                            overlay_type="strikethrough",
                            sub_term=target_term,
                            color="chalk-red"
                        ))
                break

"""
NLP Intent-to-Action Whiteboard Engine.
Transforms unstructured Professor prose, Markdown, LaTeX, and conversational teacher actions
into a dynamic Freeform Scene Graph with Chalk Overlays without rigid coordinate generation.
"""
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import List, Dict, Any, Optional, Tuple
import re
import uuid
import json


class BoardActionType(str, Enum):
    PRESENT = "PRESENT"
    CANCEL = "CANCEL"
    STRIKETHROUGH = "STRIKETHROUGH"
    ENCIRCLE = "ENCIRCLE"
    HIGHLIGHT = "HIGHLIGHT"
    ANNOTATE = "ANNOTATE"
    CONNECT = "CONNECT"
    ARROW = "ARROW"
    BRANCH = "BRANCH"
    ZONE_SPLIT = "ZONE_SPLIT"
    RETURN_TO_ANCHOR = "RETURN_TO_ANCHOR"
    STEP_PROGRESSION = "STEP_PROGRESSION"
    ERASE = "ERASE"


@dataclass
class ChalkOverlay:
    id: str
    target_node_id: str
    overlay_type: str  # strikethrough, encircle, box, callout_arrow, underline, curly_brace
    sub_term: str = ""
    color: str = "chalk-yellow"  # chalk-yellow, chalk-cyan, chalk-red, chalk-green, chalk-orange
    annotation_text: str = ""
    start_anchor: Optional[str] = None
    end_anchor: Optional[str] = None


@dataclass
class BoardNode:
    id: str
    kind: str  # heading, equation, step, text, scratchpad, diagram
    content: str
    zone_id: str = "main"
    step_num: Optional[int] = None
    latex_tokens: List[str] = field(default_factory=list)
    sub_terms: List[str] = field(default_factory=list)
    anchors: List[str] = field(default_factory=list)
    parent_id: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    w: Optional[float] = None
    h: Optional[float] = None


@dataclass
class BoardZone:
    id: str
    zone_type: str  # main, scratchpad, side_column, callout
    title: str = ""
    column_hint: str = "left"  # left, center, right, margin


@dataclass
class BoardConnection:
    id: str
    from_node_id: str
    to_node_id: str
    label: str = ""
    style: str = "curved-arrow"  # curved-arrow, straight, dashed


@dataclass
class BoardSceneGraph:
    nodes: List[BoardNode] = field(default_factory=list)
    chalk_overlays: List[ChalkOverlay] = field(default_factory=list)
    zones: List[BoardZone] = field(default_factory=list)
    connections: List[BoardConnection] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "nodes": [asdict(n) for n in self.nodes],
            "chalk_overlays": [asdict(o) for o in self.chalk_overlays],
            "zones": [asdict(z) for z in self.zones],
            "connections": [asdict(c) for c in self.connections]
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2)


@dataclass
class Segment:
    raw_text: str
    kind: str  # heading, math_display, math_inline, step, text, directive
    content: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class IntentResult:
    action_type: BoardActionType
    target_text: str = ""
    target_node_id: Optional[str] = None
    annotation: str = ""
    zone_type: str = "main"
    confidence: float = 1.0


@dataclass
class AnchorResolutionResult:
    target_node_id: str
    sub_term: str = ""
    match_confidence: float = 0.0


class StructuralSegmenter:
    """
    Stage 1: Multi-pattern AST segmenter that isolates LaTeX blocks, headings,
    steps, lists, and embedded professor chalkboard directives.
    """

    HEADING_REGEX = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)
    DISPLAY_MATH_REGEX = re.compile(r"(\$\$(?:[\s\S]*?)\$\$|\\\[(?:[\s\S]*?)\\\])", re.MULTILINE)
    INLINE_MATH_REGEX = re.compile(r"(\$(?:[^\$\n]+)\$|\\\((?:[^\)\n]+)\\\))")
    STEP_REGEX = re.compile(r"^(?:Step\s*(\d+)[:\.]?|\d+\.)\s*(.+)$", re.IGNORECASE | re.MULTILINE)
    
    # Directives that professors utter when writing on chalkboard
    DIRECTIVE_CANCELLATION = re.compile(r"(?:cancel|cross out|strike out|divide out|eliminate)\s+([^\.\n,]+)", re.IGNORECASE)
    DIRECTIVE_ENCIRCLE = re.compile(r"(?:circle|encircle|box|highlight|put a box around)\s+([^\.\n,]+)", re.IGNORECASE)
    DIRECTIVE_ARROW = re.compile(r"(?:draw an arrow from|connect|link)\s+([^\.\n,]+)\s+to\s+([^\.\n,]+)", re.IGNORECASE)
    DIRECTIVE_SCRATCHPAD = re.compile(r"(?:scratchpad|side note|margin note|on the margin)[:\s]+([^\n]+)", re.IGNORECASE)

    def segment(self, text: str) -> List[Segment]:
        segments: List[Segment] = []
        if not text or not text.strip():
            return segments

        lines = text.strip().split("\n")
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            if not line:
                i += 1
                continue

            # Check for display math block $$...$$ or \[...\]
            if line.startswith("$$") or line.startswith("\\["):
                math_lines = [line]
                if line.startswith("$$") and line.endswith("$$") and len(line) >= 4:
                    content = line[2:-2].strip()
                    segments.append(Segment(raw_text=line, kind="math_display", content=content))
                    i += 1
                    continue
                elif line.startswith("\\[") and line.endswith("\\]") and len(line) >= 4:
                    content = line[2:-2].strip()
                    segments.append(Segment(raw_text=line, kind="math_display", content=content))
                    i += 1
                    continue
                
                i += 1
                while i < len(lines):
                    m_line = lines[i].strip()
                    math_lines.append(m_line)
                    if m_line.endswith("$$") or m_line.endswith("\\]"):
                        break
                    i += 1
                full_math = "\n".join(math_lines)
                clean_content = full_math
                if clean_content.startswith("$$"):
                    clean_content = clean_content[2:]
                if clean_content.endswith("$$"):
                    clean_content = clean_content[:-2]
                if clean_content.startswith("\\["):
                    clean_content = clean_content[2:]
                if clean_content.endswith("\\]"):
                    clean_content = clean_content[:-2]
                segments.append(Segment(raw_text=full_math, kind="math_display", content=clean_content.strip()))
                i += 1
                continue

            # Check for headings
            heading_match = self.HEADING_REGEX.match(line)
            if heading_match:
                level = len(heading_match.group(1))
                content = heading_match.group(2).strip()
                segments.append(Segment(raw_text=line, kind="heading", content=content, metadata={"level": level}))
                i += 1
                continue

            # Check for numbered step
            step_match = self.STEP_REGEX.match(line)
            if step_match:
                step_num = int(step_match.group(1)) if step_match.group(1) else None
                content = step_match.group(2).strip()
                segments.append(Segment(raw_text=line, kind="step", content=content, metadata={"step_num": step_num}))
                i += 1
                continue

            # Check for code blocks
            if line.startswith("```"):
                code_lines = [line]
                i += 1
                while i < len(lines):
                    c_line = lines[i]
                    code_lines.append(c_line)
                    if c_line.strip().startswith("```"):
                        break
                    i += 1
                full_code = "\n".join(code_lines)
                clean_code = re.sub(r"^```[a-zA-Z0-9_-]*\n?", "", full_code)
                clean_code = re.sub(r"\n?```$", "", clean_code)
                segments.append(Segment(raw_text=full_code, kind="code", content=clean_code.strip()))
                i += 1
                continue

            # Check for markdown table blocks
            if line.startswith("|") and ("|" in line[1:]):
                table_lines = [line]
                i += 1
                while i < len(lines):
                    t_line = lines[i].strip()
                    if t_line.startswith("|"):
                        table_lines.append(t_line)
                    else:
                        break
                    i += 1
                full_table = "\n".join(table_lines)
                segments.append(Segment(raw_text=full_table, kind="text", content=full_table))
                continue

            # Check for bullet list groups
            if line.startswith(("- ", "* ", "+ ")) and not (self.DIRECTIVE_CANCELLATION.search(line) or self.DIRECTIVE_ENCIRCLE.search(line)):
                list_lines = [line]
                i += 1
                while i < len(lines):
                    l_line = lines[i].strip()
                    if (l_line.startswith(("- ", "* ", "+ ")) or l_line.startswith("  ")) and not (self.DIRECTIVE_CANCELLATION.search(l_line) or self.DIRECTIVE_ENCIRCLE.search(l_line)):
                        list_lines.append(l_line)
                    else:
                        break
                    i += 1
                full_list = "\n".join(list_lines)
                segments.append(Segment(raw_text=full_list, kind="text", content=full_list))
                continue

            # Check for standalone directive
            c_match = self.DIRECTIVE_CANCELLATION.search(line)
            e_match = self.DIRECTIVE_ENCIRCLE.search(line)
            if c_match:
                segments.append(Segment(raw_text=line, kind="directive", content=line, metadata={"directive_type": "cancel", "target": c_match.group(1).strip()}))
            elif e_match:
                segments.append(Segment(raw_text=line, kind="directive", content=line, metadata={"directive_type": "encircle", "target": e_match.group(1).strip()}))
            else:
                # Regular text line
                segments.append(Segment(raw_text=line, kind="text", content=line))

            i += 1

        return segments


class SemanticIntentClassifier:
    """
    Stage 2: Intent classification for actions like CANCEL, ENCIRCLE, CONNECT, BRANCH, etc.
    Combines fast semantic intent classification with syntactic heuristics.
    """

    INTENT_KEYWORDS = {
        BoardActionType.CANCEL: ["cancel", "cross out", "strikethrough", "strike out", "divide out", "eliminate", "cancels out"],
        BoardActionType.ENCIRCLE: ["circle", "encircle", "box", "highlight", "ring", "outline", "frame", "boxed"],
        BoardActionType.CONNECT: ["arrow", "connect", "link", "leads to", "points to", "substitute into"],
        BoardActionType.BRANCH: ["scratchpad", "side note", "margin", "aside", "branch", "column", "sidebar"],
        BoardActionType.RETURN_TO_ANCHOR: ["going back to", "returning to", "substitute into equation", "back to topic", "referring to"],
        BoardActionType.STEP_PROGRESSION: ["step", "first", "second", "next", "then", "finally"],
        BoardActionType.ERASE: ["erase", "clear", "wipe", "clean", "remove"]
    }

    def classify_intent(self, text: str) -> IntentResult:
        text_lower = text.lower()

        # Check for CANCEL / STRIKETHROUGH
        for kw in self.INTENT_KEYWORDS[BoardActionType.CANCEL]:
            pattern = r"\b" + re.escape(kw) + r"\b"
            if re.search(pattern, text_lower):
                match = re.search(pattern + r"\s+(?:the\s+)?([^\.\n,]+)", text_lower)
                target = match.group(1).strip() if match else ""
                return IntentResult(action_type=BoardActionType.CANCEL, target_text=target, confidence=0.95)

        # Check for ENCIRCLE / HIGHLIGHT
        for kw in self.INTENT_KEYWORDS[BoardActionType.ENCIRCLE]:
            pattern = r"\b" + re.escape(kw) + r"\b"
            if re.search(pattern, text_lower):
                match = re.search(pattern + r"\s+(?:the\s+)?([^\.\n,]+)", text_lower)
                target = match.group(1).strip() if match else ""
                return IntentResult(action_type=BoardActionType.ENCIRCLE, target_text=target, confidence=0.95)

        # Check for CONNECT / ARROW
        for kw in self.INTENT_KEYWORDS[BoardActionType.CONNECT]:
            pattern = r"\b" + re.escape(kw) + r"\b"
            if re.search(pattern, text_lower):
                return IntentResult(action_type=BoardActionType.CONNECT, target_text=text, confidence=0.9)

        # Check for BRANCH / ZONE SPLIT
        for kw in self.INTENT_KEYWORDS[BoardActionType.BRANCH]:
            pattern = r"\b" + re.escape(kw) + r"\b"
            if re.search(pattern, text_lower):
                return IntentResult(action_type=BoardActionType.BRANCH, zone_type="scratchpad", confidence=0.9)

        # Check for RETURN TO ANCHOR
        for kw in self.INTENT_KEYWORDS[BoardActionType.RETURN_TO_ANCHOR]:
            pattern = r"\b" + re.escape(kw) + r"\b"
            if re.search(pattern, text_lower):
                return IntentResult(action_type=BoardActionType.RETURN_TO_ANCHOR, target_text=text, confidence=0.85)

        # Default is PRESENT
        return IntentResult(action_type=BoardActionType.PRESENT, target_text=text, confidence=1.0)


class SpatialAnchorResolver:
    """
    Stage 3: Resolves natural language references to existing board nodes, LaTeX expressions,
    fractions, or terms on the whiteboard.
    """

    def resolve_anchor(
        self,
        instruction: str,
        target_text: str,
        current_board: List[Dict[str, Any]]
    ) -> AnchorResolutionResult:
        if not current_board:
            return AnchorResolutionResult(target_node_id="", sub_term=target_text, match_confidence=0.0)

        instr_lower = instruction.lower()
        target_lower = target_text.lower().strip("$")

        best_node_id = ""
        best_score = 0.0
        best_sub_term = target_text.strip("$")

        for node in current_board:
            node_id = node.get("id", "")
            node_content = str(node.get("content", ""))
            node_type = str(node.get("type", ""))
            node_content_lower = node_content.lower()

            # Exact or substring match in node content
            if target_lower and target_lower in node_content_lower:
                return AnchorResolutionResult(target_node_id=node_id, sub_term=target_text.strip("$"), match_confidence=1.0)

            # Check for step reference e.g., "Step 1" -> step_1
            if "step" in instr_lower:
                step_m = re.search(r"step\s*(\d+)", instr_lower)
                if step_m:
                    step_num = int(step_m.group(1))
                    if node.get("step_num") == step_num or f"step {step_num}" in node_content_lower or node_id == f"step_{step_num}":
                        return AnchorResolutionResult(target_node_id=node_id, sub_term=target_text, match_confidence=0.95)

            # Check for equation / discriminant references
            if ("discriminant" in instr_lower or "b^2 - 4ac" in target_lower) and ("b^2 - 4ac" in node_content or "sqrt" in node_content):
                return AnchorResolutionResult(target_node_id=node_id, sub_term="b^2 - 4ac", match_confidence=0.9)

            # Recency bias fallback: if instruction refers to "previous" or "this", prefer latest equation
            if node_type in ["equation", "math_display"]:
                best_node_id = node_id
                best_score = 0.5

        if not best_node_id and current_board:
            best_node_id = current_board[-1].get("id", "")

        return AnchorResolutionResult(target_node_id=best_node_id, sub_term=best_sub_term, match_confidence=best_score)


class SceneGraphEmitter:
    """
    Stage 4: Assembles segments, intents, and resolved anchors into a complete BoardSceneGraph.
    """

    def build_scene_graph(
        self,
        segments: List[Segment],
        current_board: Optional[List[Dict[str, Any]]] = None,
        classifier: Optional[SemanticIntentClassifier] = None,
        anchor_resolver: Optional[SpatialAnchorResolver] = None
    ) -> BoardSceneGraph:
        classifier = classifier or SemanticIntentClassifier()
        anchor_resolver = anchor_resolver or SpatialAnchorResolver()
        current_board_nodes = list(current_board or [])

        scene_graph = BoardSceneGraph()
        # Default main zone
        main_zone = BoardZone(id="main_zone", zone_type="main", title="Chalkboard", column_hint="left")
        scene_graph.zones.append(main_zone)

        active_zone_id = "main_zone"
        current_heading_node_id = None
        last_node_id = None

        for seg in segments:
            # Check for chalk directives
            intent = classifier.classify_intent(seg.content)

            if intent.action_type in [BoardActionType.CANCEL, BoardActionType.STRIKETHROUGH]:
                # Find target node
                target = intent.target_text or seg.metadata.get("target", "")
                resolved = anchor_resolver.resolve_anchor(seg.content, target, current_board_nodes)
                target_id = resolved.target_node_id or last_node_id or "node_1"
                overlay = ChalkOverlay(
                    id=f"chalk_{uuid.uuid4().hex[:6]}",
                    target_node_id=target_id,
                    overlay_type="strikethrough",
                    sub_term=resolved.sub_term or target,
                    color="chalk-red",
                    annotation_text=seg.content
                )
                scene_graph.chalk_overlays.append(overlay)
                continue

            elif intent.action_type in [BoardActionType.ENCIRCLE, BoardActionType.HIGHLIGHT]:
                target = intent.target_text or seg.metadata.get("target", "")
                resolved = anchor_resolver.resolve_anchor(seg.content, target, current_board_nodes)
                target_id = resolved.target_node_id or last_node_id or "node_1"
                overlay = ChalkOverlay(
                    id=f"chalk_{uuid.uuid4().hex[:6]}",
                    target_node_id=target_id,
                    overlay_type="encircle",
                    sub_term=resolved.sub_term or target,
                    color="chalk-yellow",
                    annotation_text=seg.content
                )
                scene_graph.chalk_overlays.append(overlay)
                continue

            elif intent.action_type in [BoardActionType.BRANCH, BoardActionType.ZONE_SPLIT]:
                # Create a side scratchpad zone
                scratch_zone_id = f"scratch_{uuid.uuid4().hex[:6]}"
                scene_graph.zones.append(BoardZone(id=scratch_zone_id, zone_type="scratchpad", title="Scratchpad", column_hint="right"))
                active_zone_id = scratch_zone_id
                
                node = BoardNode(
                    id=f"node_{uuid.uuid4().hex[:6]}",
                    kind="scratchpad",
                    content=seg.content,
                    zone_id=active_zone_id
                )
                scene_graph.nodes.append(node)
                current_board_nodes.append({"id": node.id, "type": node.kind, "content": node.content})
                last_node_id = node.id
                continue

            elif intent.action_type == BoardActionType.CONNECT:
                if last_node_id and current_board_nodes:
                    conn = BoardConnection(
                        id=f"conn_{uuid.uuid4().hex[:6]}",
                        from_node_id=current_board_nodes[0].get("id", last_node_id),
                        to_node_id=last_node_id,
                        label="leads to"
                    )
                    scene_graph.connections.append(conn)
                continue

            # Standard node generation
            node_id = f"node_{uuid.uuid4().hex[:6]}"
            kind = "text"
            if seg.kind == "heading":
                kind = "heading"
                current_heading_node_id = node_id
            elif seg.kind == "math_display":
                kind = "equation"
            elif seg.kind == "step":
                kind = "step"

            # Check for embedded \cancel or \boxed in LaTeX
            if "\\cancel{" in seg.content:
                cancel_match = re.search(r"\\cancel\{([^}]+)\}", seg.content)
                if cancel_match:
                    sub_t = cancel_match.group(1)
                    overlay = ChalkOverlay(
                        id=f"chalk_{uuid.uuid4().hex[:6]}",
                        target_node_id=node_id,
                        overlay_type="strikethrough",
                        sub_term=sub_t,
                        color="chalk-red"
                    )
                    scene_graph.chalk_overlays.append(overlay)

            if "\\boxed{" in seg.content:
                box_match = re.search(r"\\boxed\{([^}]+)\}", seg.content)
                if box_match:
                    sub_t = box_match.group(1)
                    overlay = ChalkOverlay(
                        id=f"chalk_{uuid.uuid4().hex[:6]}",
                        target_node_id=node_id,
                        overlay_type="box",
                        sub_term=sub_t,
                        color="chalk-yellow"
                    )
                    scene_graph.chalk_overlays.append(overlay)

            node = BoardNode(
                id=node_id,
                kind=kind,
                content=seg.content,
                zone_id=active_zone_id,
                step_num=seg.metadata.get("step_num"),
                parent_id=current_heading_node_id if kind != "heading" else None
            )
            scene_graph.nodes.append(node)
            current_board_nodes.append({"id": node.id, "type": node.kind, "content": node.content, "step_num": node.step_num})
            last_node_id = node.id

        # ── Dynamic 2D Spatial Layout Allocation ────────────────────
        has_scratchpad = any(n.kind == "scratchpad" or "scratch" in n.zone_id for n in scene_graph.nodes)
        
        main_x = 3.0
        main_w = 66.0 if has_scratchpad else 94.0
        scratch_x = 72.0
        scratch_w = 26.0

        main_y = 2.0
        scratch_y = 4.0

        for node in scene_graph.nodes:
            if node.kind == "scratchpad" or "scratch" in node.zone_id:
                lines_count = max(1, len(node.content.split("\n")))
                h = max(12.0, min(35.0, 7.0 + lines_count * 3.5))
                node.x = scratch_x
                node.y = round(scratch_y, 1)
                node.w = scratch_w
                node.h = round(h, 1)
                scratch_y += h + 3.0
            else:
                lines_count = max(1, len(node.content.split("\n")))
                if node.kind == "heading":
                    h = 8.0
                    w = main_w
                    x = main_x
                elif node.kind == "equation":
                    h = 11.0
                    w = min(main_w - 4.0, 60.0) if not has_scratchpad else main_w - 2.0
                    x = main_x + 1.0
                elif node.kind == "step":
                    h = max(12.0, min(25.0, 7.0 + lines_count * 3.5))
                    w = main_w
                    x = main_x
                elif node.kind in ["diagram", "asset"]:
                    h = 25.0
                    w = min(main_w, 55.0)
                    x = main_x + (main_w - w) / 2.0
                else:  # text / concept_node
                    h = max(9.0, min(30.0, 6.0 + lines_count * 3.2))
                    w = main_w
                    x = main_x
                
                node.x = round(x, 1)
                node.y = round(main_y, 1)
                node.w = round(w, 1)
                node.h = round(h, 1)
                main_y += h + 2.5

        return scene_graph


class BoardIntentEngine:
    """
    Main entry point for converting raw Professor text into a dynamic Scene Graph.
    """

    def __init__(self):
        self.segmenter = StructuralSegmenter()
        self.classifier = SemanticIntentClassifier()
        self.anchor_resolver = SpatialAnchorResolver()
        self.emitter = SceneGraphEmitter()

    def process_professor_prose(
        self,
        raw_text: str,
        current_board: Optional[List[Dict[str, Any]]] = None
    ) -> BoardSceneGraph:
        segments = self.segmenter.segment(raw_text)
        return self.emitter.build_scene_graph(
            segments=segments,
            current_board=current_board,
            classifier=self.classifier,
            anchor_resolver=self.anchor_resolver
        )

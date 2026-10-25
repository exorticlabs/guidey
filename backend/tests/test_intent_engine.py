"""
Test suite for NLP Intent-to-Action Whiteboard Engine.
Validates the 4-stage pipeline:
1. Structural Segmentation (Markdown + LaTeX extraction)
2. Semantic Intent Classification
3. Spatial Anchor Resolution (resolving 'cancel the 2 in denominator', 'arrow from step 1 to 2', returning to earlier topic)
4. Freeform Scene Graph & Chalk Overlay Generation
"""
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

try:
    import pytest
except ImportError:
    pytest = None
import json

from agent.core.intent_engine import (
    StructuralSegmenter,
    SemanticIntentClassifier,
    SpatialAnchorResolver,
    SceneGraphEmitter,
    BoardIntentEngine,
    BoardActionType,
    BoardNode,
    ChalkOverlay
)


def _fixture(fn):
    return pytest.fixture(fn) if pytest else fn

@_fixture
def intent_engine():
    return BoardIntentEngine()


class TestStructuralSegmentation:
    """Stage 1: Parser handles complex LaTeX, inline math, headings, multi-line blocks, chalk notes"""
    
    def test_mixed_latex_and_prose_segmentation(self, intent_engine):
        raw_text = """
# Product Rule for Derivatives
Let $u = f(x)$ and $v = g(x)$.
The derivative is given by:
$$\\frac{d}{dx}[u \\cdot v] = u \\frac{dv}{dx} + v \\frac{du}{dx}$$
Notice how we differentiate one term at a time!
"""
        segments = intent_engine.segmenter.segment(raw_text)
        assert len(segments) >= 3
        # Should have header
        headers = [s for s in segments if s.kind == "heading"]
        assert len(headers) == 1
        assert "Product Rule" in headers[0].content

        # Should have display math equation
        math_segs = [s for s in segments if s.kind == "math_display"]
        assert len(math_segs) == 1
        assert "\\frac{d}{dx}" in math_segs[0].content

    def test_algebra_cancellation_segmentation(self, intent_engine):
        raw_text = """
$$\\frac{2x^2 + 4x}{2x} = \\frac{2x(x + 2)}{2x}$$
Now cancel the common factor $2x$ from top and bottom to leave $x + 2$.
"""
        segments = intent_engine.segmenter.segment(raw_text)
        assert any("2x" in s.content for s in segments)
        assert len(segments) >= 2

    def test_multi_equation_step_breakdown(self, intent_engine):
        raw_text = """
Step 1: Expand $(x + 3)(x - 2)$
$$= x^2 - 2x + 3x - 6$$
Step 2: Combine like terms:
$$= x^2 + x - 6$$
"""
        segments = intent_engine.segmenter.segment(raw_text)
        assert len(segments) >= 4


class TestSemanticIntentClassification:
    """Stage 2: Classify semantic action intentions without brittle regex"""
    
    def test_cancel_strikethrough_intent(self, intent_engine):
        text = "Cross out the 2 in the numerator and denominator since they divide to 1."
        intent = intent_engine.classifier.classify_intent(text)
        assert intent.action_type in [BoardActionType.CANCEL, "CANCEL", "STRIKETHROUGH"]

    def test_highlight_encircle_intent(self, intent_engine):
        text = "Circle the final answer $x = 5$ on the right side."
        intent = intent_engine.classifier.classify_intent(text)
        assert intent.action_type in [BoardActionType.ENCIRCLE, BoardActionType.HIGHLIGHT, "ENCIRCLE", "HIGHLIGHT"]

    def test_connect_arrow_intent(self, intent_engine):
        text = "Draw an arrow from this initial condition to the boundary equation."
        intent = intent_engine.classifier.classify_intent(text)
        assert intent.action_type in [BoardActionType.CONNECT, "CONNECT", "ARROW"]

    def test_branch_scratchpad_intent(self, intent_engine):
        text = "Let's make a quick scratchpad note on the right margin for factoring $x^2 - 9$."
        intent = intent_engine.classifier.classify_intent(text)
        assert intent.action_type in [BoardActionType.BRANCH, BoardActionType.ZONE_SPLIT, "BRANCH", "ZONE_SPLIT"]

    def test_return_to_previous_topic_intent(self, intent_engine):
        text = "Going back to Equation (1) at the top, let's substitute $y = 3$."
        intent = intent_engine.classifier.classify_intent(text)
        assert intent.action_type in [BoardActionType.RETURN_TO_ANCHOR, BoardActionType.ANNOTATE, "RETURN_TO_ANCHOR", "ANNOTATE"]


class TestSpatialAnchorResolution:
    """Stage 3: Spatial resolution - resolving references to existing board nodes & sub-terms"""
    
    def test_anchor_resolution_to_equation_terms(self, intent_engine):
        # Mock active board state with existing nodes
        board_state = [
            {"id": "node_1", "type": "heading", "content": "Quadratic Formula"},
            {"id": "node_2", "type": "equation", "content": "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}"},
            {"id": "node_3", "type": "text", "content": "Where $b^2 - 4ac$ is the discriminant"}
        ]
        
        # Instruction to encircle discriminant
        resolved = intent_engine.anchor_resolver.resolve_anchor(
            instruction="Highlight the discriminant inside the square root",
            target_text="b^2 - 4ac",
            current_board=board_state
        )
        assert resolved.target_node_id in ["node_2", "node_3"]
        assert "b^2 - 4ac" in resolved.sub_term

    def test_anchor_resolution_step_reference(self, intent_engine):
        board_state = [
            {"id": "step_1", "type": "step", "content": "Step 1: Simplify brackets", "step_num": 1},
            {"id": "step_2", "type": "step", "content": "Step 2: Collect constants", "step_num": 2}
        ]
        resolved = intent_engine.anchor_resolver.resolve_anchor(
            instruction="Connect Step 1 to Step 2 with an arrow indicating substitution",
            target_text="Step 1",
            current_board=board_state
        )
        assert resolved.target_node_id == "step_1"


class TestSceneGraphAndChalkEmission:
    """Stage 4: Complete end-to-end pipeline converts professor prose into scene graph with chalk overlays"""

    def test_full_math_lesson_scene_graph(self, intent_engine):
        professor_output = """
# Solving Rational Equations

Let's solve:
$$\\frac{2(x + 3)}{x + 3} = 4$$

Notice $(x + 3)$ appears in both numerator and denominator.
Cancel $(x + 3)$ from both numerator and denominator!

This simplifies immediately to:
$$2 = 4$$

Since $2 \\neq 4$, there is **No Solution**! Circle this result.
"""
        scene_graph = intent_engine.process_professor_prose(professor_output, current_board=[])
        
        # Validate nodes created
        nodes = scene_graph.nodes
        assert len(nodes) >= 3
        
        # Validate chalk overlays
        overlays = scene_graph.chalk_overlays
        # Must have at least one strike/cancel and one circle/box/highlight
        overlay_types = [ov.overlay_type for ov in overlays]
        assert any(t in ["strikethrough", "cancel", "cross_out"] for t in overlay_types)
        assert any(t in ["encircle", "circle", "box", "highlight"] for t in overlay_types)

    def test_freeform_branching_scene_graph(self, intent_engine):
        professor_output = """
# Binary Search Trees

Main property:
Left < Root < Right

Side note on balance:
If unbalanced, height can degrade to $O(n)$ like a linked list!
"""
        scene_graph = intent_engine.process_professor_prose(professor_output, current_board=[])
        zones = scene_graph.zones
        assert len(zones) >= 1
        assert len(scene_graph.nodes) >= 2

    def test_json_serializable_output(self, intent_engine):
        professor_output = "## Theorem\n$$E = mc^2$$\nHighlight the energy-mass equivalence."
        scene_graph = intent_engine.process_professor_prose(professor_output)
        json_str = scene_graph.to_json()
        data = json.loads(json_str)
        assert "nodes" in data
        assert "chalk_overlays" in data
        assert "zones" in data

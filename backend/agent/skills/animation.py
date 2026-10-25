import json
from pathlib import Path
from typing import Dict, Any, List
from config import WORKSPACES_DIR, get_safe_workspace_path, sanitize_identifier
from core.agent import AnimationAgent

class AnimationManager:
    """Manages cached pre-defined visual animations and dynamically generates frames using AnimationAgent."""
    
    def __init__(self):
        self.agent = AnimationAgent()
        self._predefined = self._load_predefined_animations()

    def _get_cache_path(self, workspace_id: str, topic_id: str) -> Path:
        anim_dir = get_safe_workspace_path(workspace_id) / "animations"
        anim_dir.mkdir(parents=True, exist_ok=True)
        safe_topic = sanitize_identifier(topic_id, "default_topic")
        return anim_dir / f"{safe_topic}.json"

    def get_animation(self, workspace_id: str, topic_id: str, topic_name: str) -> Dict[str, Any]:
        """Gets a pre-calculated educational animation or generates a dynamic one."""
        # 1. Check if it matches predefined
        slug = topic_id.lower().replace("-", "_")
        for key in self._predefined:
            if key in slug or slug in key:
                return self._predefined[key]
                
        # 2. Check if already cached in workspace
        path = self._get_cache_path(workspace_id, topic_id)
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
                
        # 3. Generate dynamically
        prompt = f"Topic Name: {topic_name}\nPlease generate the visual animation frames for this topic."
        
        result = self.agent.run_json(prompt)
        
        if "error" in result or "frames" not in result:
            # Basic fallback animation
            result = {
                "topic": topic_name,
                "frames": [
                    {
                        "step": 1,
                        "title": f"Introduction to {topic_name}",
                        "description": f"The process starts with initialization of variables and state setup for {topic_name}.",
                        "elements": [
                            { "id": "node_1", "type": "node", "label": "Start", "x": 0, "y": 0, "highlight": True },
                            { "id": "node_2", "type": "node", "label": "End", "x": 3, "y": 0, "highlight": False }
                        ]
                    },
                    {
                        "step": 2,
                        "title": "Executing Core Transition",
                        "description": "The logic is applied, processing inputs and updating calculations in the core loop.",
                        "elements": [
                            { "id": "node_1", "type": "node", "label": "Start", "x": 1, "y": 0, "highlight": True },
                            { "id": "node_2", "type": "node", "label": "End", "x": 2, "y": 0, "highlight": True }
                        ]
                    },
                    {
                        "step": 3,
                        "title": "Completion State",
                        "description": "The calculations conclude, showing the final computed output state.",
                        "elements": [
                            { "id": "node_1", "type": "node", "label": "Start", "x": 1.5, "y": 0, "highlight": False },
                            { "id": "node_2", "type": "node", "label": "End", "x": 1.5, "y": 0, "highlight": True }
                        ]
                    }
                ]
            }

        # Cache dynamic animation
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2, ensure_ascii=True)
        except Exception:
            pass
            
        return result

    def _load_predefined_animations(self) -> Dict[str, Dict[str, Any]]:
        """Loads modular animation templates from the assets directory."""
        from config import PROJECT_ROOT
        asset_dir = PROJECT_ROOT / "tools" / "assets" / "animations"
        templates = {}
        if asset_dir.exists():
            for json_file in asset_dir.glob("*.json"):
                try:
                    import json
                    with open(json_file, "r", encoding="utf-8") as f:
                        templates[json_file.stem] = json.load(f)
                except Exception:
                    pass
        return templates

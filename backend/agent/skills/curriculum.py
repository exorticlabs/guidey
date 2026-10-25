import json
from pathlib import Path
from typing import Dict, Any, List, Set, Tuple
from config import WORKSPACES_DIR, get_safe_workspace_path
from core.agent import CurriculumAgent

class CurriculumManager:
    """Manages workspace syllabi, topics, dependencies (DAG), and traversal."""
    
    def __init__(self):
        self.agent = CurriculumAgent()

    def _get_curriculum_path(self, workspace_id: str) -> Path:
        ws_dir = get_safe_workspace_path(workspace_id)
        if str(workspace_id).startswith("org/"):
            return ws_dir / "graph.json"
        return ws_dir / "curriculum.json"

    def load_curriculum(self, workspace_id: str) -> Dict[str, Any]:
        """Loads curriculum topics and dependencies for a workspace."""
        path = self._get_curriculum_path(workspace_id)
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {"topics": []}

    def save_curriculum(self, workspace_id: str, data: Dict[str, Any]):
        """Saves curriculum topics and dependencies for a workspace."""
        path = self._get_curriculum_path(workspace_id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=True)

    def parse_and_save_syllabus(self, workspace_id: str, syllabus_text: str) -> Dict[str, Any]:
        """Uses CurriculumAgent to parse syllabus text and saves the resulting DAG."""
        # Use LLM agent to parse
        result = self.agent.run_json(f"Analyze the following syllabus text and extract a structured knowledge graph:\n\n{syllabus_text}")
        
        if "error" in result:
            # Check if there is a topics key in case it returned some error structure
            if "topics" not in result:
                # Return standard failure
                return result
                
        self.save_curriculum(workspace_id, result)
        return result

    def get_topics_dict(self, workspace_id: str) -> Dict[str, Dict[str, Any]]:
        """Returns topics mapped by their ID for quick lookup."""
        curr = self.load_curriculum(workspace_id)
        return {topic["id"]: topic for topic in curr.get("topics", [])}

    def get_topological_sort(self, workspace_id: str) -> List[Dict[str, Any]]:
        """Returns the topics in a valid topological learning order (prerequisites first)."""
        topics_dict = self.get_topics_dict(workspace_id)
        
        # Build adjacency list & incoming degrees
        adj: Dict[str, List[str]] = {tid: [] for tid in topics_dict}
        in_degree: Dict[str, int] = {tid: 0 for tid in topics_dict}
        
        for tid, topic in topics_dict.items():
            for prereq in topic.get("prerequisites", []):
                if prereq in adj:
                    adj[prereq].append(tid)
                    in_degree[tid] += 1
                else:
                    # Prerequisite topic ID not in syllabus list, handle gracefully
                    pass
                    
        # Find sources (in_degree = 0)
        queue = [tid for tid, deg in in_degree.items() if deg == 0]
        order = []
        
        # BFS / Kahn's algorithm
        while queue:
            # Sort to make it deterministic
            queue.sort()
            curr = queue.pop(0)
            order.append(topics_dict[curr])
            
            for neighbor in adj[curr]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)
                    
        # If there are cycle issues, append remaining topics to make it robust
        if len(order) < len(topics_dict):
            ordered_ids = {t["id"] for t in order}
            for tid, topic in topics_dict.items():
                if tid not in ordered_ids:
                    order.append(topic)
                    
        return order

    def check_prerequisites(self, workspace_id: str, topic_id: str, student_mastery: Dict[str, int], threshold: int = 70) -> Tuple[bool, str | None]:
        """
        Checks if the student meets all prerequisites for a topic.
        Returns:
            (is_ready, lowest_missing_prerequisite_id)
        """
        topics_dict = self.get_topics_dict(workspace_id)
        if topic_id not in topics_dict:
            return True, None
            
        lowest_missing = self.find_lowest_missing_prereq(workspace_id, topic_id, student_mastery, threshold)
        
        if lowest_missing and lowest_missing != topic_id:
            return False, lowest_missing
        elif lowest_missing == topic_id:
            # The topic itself is missing prerequisites? No, it means the topic itself is unmet,
            # but its prerequisites are met. That means we are ready to teach this topic!
            return True, None
        return True, None

    def find_lowest_missing_prereq(self, workspace_id: str, topic_id: str, student_mastery: Dict[str, int], threshold: int = 70, visited: Set[str] = None) -> str | None:
        """Recursively traverses dependencies to find the deepest unmet prerequisite."""
        if visited is None:
            visited = set()
            
        if topic_id in visited:
            return None
        visited.add(topic_id)
        
        topics_dict = self.get_topics_dict(workspace_id)
        topic = topics_dict.get(topic_id)
        if not topic:
            return None
            
        prereqs = topic.get("prerequisites", [])
        
        # Check direct prerequisites that are unmet (mastery < threshold)
        unmet_prereqs = [p for p in prereqs if p in topics_dict and student_mastery.get(p, 0) < threshold]
        
        if not unmet_prereqs:
            # If all prerequisites are met (or there are none), check if the current topic itself is unmet
            if student_mastery.get(topic_id, 0) < threshold:
                return topic_id
            return None
            
        # If there are unmet prerequisites, traverse them to find the deepest one
        for p in unmet_prereqs:
            lowest = self.find_lowest_missing_prereq(workspace_id, p, student_mastery, threshold, visited)
            if lowest:
                return lowest
                
        # Default fallback
        return unmet_prereqs[0]

import json
from pathlib import Path
from typing import Dict, Any, List
from config import WORKSPACES_DIR, RESEARCH_DIR, get_safe_workspace_path, sanitize_identifier
from core.agent import ResearchAgent
from tools.search.web_search import search as run_web_search

class ResearchManager:
    """Manages creation and retrieval of cached Topic Knowledge Packages, and performs dynamic web searches."""
    
    def __init__(self):
        self.agent = ResearchAgent()

    def _get_package_path(self, workspace_id: str, topic_id: str) -> Path:
        research_path = get_safe_workspace_path(workspace_id) / "research"
        research_path.mkdir(parents=True, exist_ok=True)
        safe_topic = sanitize_identifier(topic_id, "default_topic")
        return research_path / f"{safe_topic}.json"

    def get_knowledge_package(self, workspace_id: str, topic_id: str) -> Dict[str, Any] | None:
        """Retrieves cached Topic Knowledge Package if it exists."""
        path = self._get_package_path(workspace_id, topic_id)
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return None

    def build_and_cache_package(self, workspace_id: str, topic_id: str, topic_name: str, topic_desc: str) -> Dict[str, Any]:
        """Uses ResearchAgent to build a comprehensive knowledge package and caches it."""
        # Check if already cached
        cached = self.get_knowledge_package(workspace_id, topic_id)
        if cached:
            return cached
            
        # Compile a prompt for ResearchAgent
        prompt_input = f"Topic Name: {topic_name}\nDescription: {topic_desc}"
        
        # Build the package via the agent
        package = self.agent.run_json(prompt_input)
        
        if "error" in package:
            # Handle failure gracefully by creating a basic fallback
            package = {
                "definitions": f"Core explanation of {topic_name}: {topic_desc}",
                "visual_explanations": f"Visualizing {topic_name}: [Pre-loaded explanation visual]",
                "examples": [
                    {"problem": f"Define and explain {topic_name}.", "solution": "See definitions section."}
                ],
                "misconceptions": [
                    {"misconception": "Confusing terminology.", "correction": "Carefully review definitions."}
                ],
                "applications": [f"Standard industry applications of {topic_name}."]
            }
            
        # Cache the package
        path = self._get_package_path(workspace_id, topic_id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(package, f, indent=2, ensure_ascii=True)
            
        return package

    def perform_dynamic_research(self, query: str) -> Dict[str, Any]:
        """Triggers a web search and merges the results into a summarized response."""
        try:
            # Perform actual web search using our utility
            search_result = run_web_search(query)
            results = search_result.get("results", [])
            
            # Format results for the LLM
            links_str = ""
            for idx, res in enumerate(results[:5], start=1):
                links_str += f"{idx}. {res['title']} (URL: {res['url']})\n"
                
            # Compile a prompt to synthesize the search results
            prompt = f"Query: {query}\nLinks:\n{links_str}"
            
            from core.brain.llm_cloud import run_llm
            synthesis = run_llm(prompt)
            
            return {
                "ok": True,
                "synthesis": synthesis,
                "sources": results[:5]
            }
            
        except Exception as e:
            return {
                "ok": False,
                "error": f"Failed to run dynamic web research: {str(e)}",
                "synthesis": "I ran into an issue searching the web. Please try again or ask another question."
            }

import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from .session import BrowserSession
from core.brain.llm_cloud import run_llm

CACHE_FILE = Path("agent_memory/browser_selector_cache.json")

def _load_cache() -> dict:
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def _save_cache(cache: dict):
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CACHE_FILE, "w") as f:
        json.dump(cache, f, indent=2)

def _get_page_elements(session: BrowserSession) -> str:
    script = """
    () => {
        const els = Array.from(document.querySelectorAll('a, button, input, textarea, select, [role="button"], [role="link"], [role="tab"], [role="menuitem"]'));
        return els.map((el, i) => el.cloneNode(false).outerHTML).join('\\n');
    }
    """
    try:
        return session.page.evaluate(script)
    except Exception:
        return ""

def _analyze_selectors(url: str, elements_html: str, descriptions: list[str]) -> dict:
    prompt = f"""
You are an AI browser assistant. The user wants to interact with elements on a webpage.
URL: {url}

Here are the interactive elements on the page:
```html
{elements_html[:15000]}
```

We need CSS selectors for the following descriptions:
{json.dumps(descriptions, indent=2)}

Return ONLY a JSON dictionary mapping each description exactly to the best unique CSS selector you can find in the HTML provided.
Prefer unique IDs, data-attributes, distinct classes, or specific attribute combinations.
Example: {{"click login button": "button#login-btn", "email input field": "input[name='email']"}}
"""
    response = run_llm(prompt)
    try:
        cleaned = re.sub(r"```(?:json)?", "", response).replace("```", "").strip()
        return json.loads(cleaned)
    except Exception as e:
        print(f"Error parsing LLM response for selectors: {e}")
        return {}

def run_autonomous_steps(session: BrowserSession, steps: list[dict[str, Any]], max_retries: int = 1) -> dict[str, Any]:
    cache = _load_cache()
    outcomes = []
    
    for idx, original_step in enumerate(steps, start=1):
        # We make a copy to avoid mutating the original
        step = dict(original_step)
        action = step.get("action")
        
        # Actions that don't need a selector
        if action in ["goto", "wait", "scroll", "content", "detect_captcha", "screenshot", "evaluate", "elements", "ui_tree", "start", "close"]:
            res = session.run_steps([step])
            if res.get("results"):
                outcomes.append({"step": idx, **res["results"][0]})
            if not res["ok"]:
                return {"ok": False, "results": outcomes}
            continue
            
        # Actions that need a selector
        desc = step.get("description")
        if not desc and "selector" in step:
            # Normal action
            res = session.run_steps([step])
            if res.get("results"):
                outcomes.append({"step": idx, **res["results"][0]})
            if not res["ok"]:
                return {"ok": False, "results": outcomes}
            continue
            
        # Needs resolution
        if not desc:
            outcomes.append({"step": idx, "ok": False, "error": "Missing description or selector"})
            return {"ok": False, "results": outcomes}
            
        success = False
        for attempt in range(max_retries + 1):
            current_url = session.page.url if session.page else "about:blank"
            domain = urlparse(current_url).netloc

            if domain not in cache:
                cache[domain] = {}

            if desc in cache[domain]:
                step["selector"] = cache[domain][desc]
            else:
                elements_html = _get_page_elements(session)
                new_selectors = _analyze_selectors(current_url, elements_html, [desc])
                sel = new_selectors.get(desc)
                if not sel:
                    outcomes.append({"step": idx, "ok": False, "error": f"Failed to resolve selector for '{desc}'"})
                    success = False
                    break
                cache[domain][desc] = sel
                step["selector"] = sel
                _save_cache(cache)
                
            res = session.run_steps([step])
            if res["ok"]:
                if res.get("results"):
                    outcomes.append({"step": idx, **res["results"][0]})
                success = True
                break
            else:
                # Failed. Invalidate cache and retry
                if attempt < max_retries:
                    if desc in cache[domain]:
                        del cache[domain][desc]
                    if "selector" in step:
                        del step["selector"]
                    print(f"Retrying step '{desc}' due to failure: {res['results'][0].get('error') if res.get('results') else 'Unknown'}")
                else:
                    if res.get("results"):
                        outcomes.append({"step": idx, **res["results"][0]})
                    success = False
                    
        if not success:
            return {"ok": False, "results": outcomes}
            
    return {"ok": True, "results": outcomes}

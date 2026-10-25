from __future__ import annotations

import json
from typing import Any

from .session import BrowserSession


class BrowserSkill:
    """Unified browser skill with Playwright engine and Puppeteer-like action schema."""

    def __init__(self):
        self.session = BrowserSession()

    def execute(self, action: str, **kwargs) -> dict[str, Any]:
        if action == "start":
            return self.session.start()
        if action == "close":
            return self.session.close()
        if action == "goto":
            return self.session.goto(kwargs["url"], kwargs.get("wait_until", "domcontentloaded"))
        if action == "click":
            return self.session.click(kwargs["selector"])
        if action == "type":
            return self.session.type(kwargs["selector"], kwargs.get("text", ""), kwargs.get("clear", True))
        if action == "fill":
            return self.session.fill(kwargs["selector"], kwargs.get("text", ""))
        if action == "press":
            return self.session.press(kwargs["selector"], kwargs["key"])
        if action == "wait_for_selector":
            return self.session.wait_for_selector(kwargs["selector"], kwargs.get("timeout_ms"))
        if action == "wait":
            return self.session.wait_for_timeout(int(kwargs.get("timeout_ms", 1000)))
        if action == "scroll":
            return self.session.scroll(int(kwargs.get("x", 0)), int(kwargs.get("y", 800)))
        if action == "screenshot":
            return self.session.screenshot(kwargs.get("path", "agent_memory/screenshots/shot.png"), kwargs.get("full_page", True))
        if action == "content":
            return self.session.content()
        if action == "text":
            return self.session.text(kwargs["selector"])
        if action == "elements":
            return self.session.list_interactive_elements(int(kwargs.get("max_items", 80)))
        if action == "ui_tree":
            return self.session.ui_tree(int(kwargs.get("max_nodes", 200)))
        if action == "detect_captcha":
            return self.session.detect_captcha()
        if action == "evaluate":
            return self.session.evaluate(kwargs["script"], kwargs.get("arg"))
        if action == "steps":
            from .autonomous import run_autonomous_steps
            return run_autonomous_steps(self.session, kwargs.get("steps", []))
        return {"ok": False, "error": f"unknown browser action: {action}"}

    def execute_json(self, payload: str) -> dict[str, Any]:
        try:
            obj = json.loads(payload)
            action = obj.get("action")
            if not action:
                return {"ok": False, "error": "missing action"}
            return self.execute(action, **obj)
        except Exception as exc:
            return {"ok": False, "error": f"invalid json: {exc}"}
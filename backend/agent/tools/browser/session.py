from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse
from typing import Any


@dataclass
class BrowserConfig:
    headless: bool = False
    viewport_width: int = 1440
    viewport_height: int = 900
    timeout_ms: int = 15000
    user_agent: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )


class BrowserSession:
    def __init__(self, config: BrowserConfig | None = None):
        self.config = config or BrowserConfig()
        self._playwright = None
        self._browser = None
        self._context = None
        self._page = None

    @property
    def page(self):
        return self._page

    def start(self) -> dict[str, Any]:
        if self._browser:
            return {"ok": True, "message": "browser already started"}

        try:
            from playwright.sync_api import sync_playwright
        except Exception as exc:
            return {
                "ok": False,
                "error": "Playwright is not installed. Run: pip install playwright && playwright install chromium",
                "detail": str(exc),
            }

        self._playwright = sync_playwright().start()
        self._browser = self._playwright.chromium.launch(
            headless=self.config.headless,
            args=["--disable-blink-features=AutomationControlled"],
        )
        self._context = self._browser.new_context(
            viewport={"width": self.config.viewport_width, "height": self.config.viewport_height},
            user_agent=self.config.user_agent,
            extra_http_headers={
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Sec-CH-UA": "\"Chromium\";v=\"124\", \"Google Chrome\";v=\"124\", \"Not-A.Brand\";v=\"99\"",
                "Sec-CH-UA-Mobile": "?0",
                "Sec-CH-UA-Platform": "\"Windows\"",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1",
                "Upgrade-Insecure-Requests": "1"
            },
            bypass_csp=True
        )
        
        # Add a quick initialization script to hide Playwright signature
        init_script = """
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        """
        self._context.add_init_script(init_script)
        self._page = self._context.new_page()
        self._page.set_default_timeout(self.config.timeout_ms)
        return {"ok": True, "message": "browser started"}

    def close(self) -> dict[str, Any]:
        try:
            if self._context:
                self._context.close()
            if self._browser:
                self._browser.close()
            if self._playwright:
                self._playwright.stop()
        finally:
            self._playwright = None
            self._browser = None
            self._context = None
            self._page = None
        return {"ok": True, "message": "browser closed"}

    def ensure_started(self) -> dict[str, Any]:
        if not self._browser:
            return self.start()
        return {"ok": True}

    def goto(self, url: str, wait_until: str = "domcontentloaded") -> dict[str, Any]:
        init = self.ensure_started()
        if not init.get("ok"):
            return init
        normalized = self._normalize_url(url)
        response = self._page.goto(normalized, wait_until=wait_until)
        return {
            "ok": True,
            "url": self._page.url,
            "status": getattr(response, "status", None),
            "title": self._page.title(),
        }

    def _normalize_url(self, url: str) -> str:
        if not url:
            return url
        parsed = urlparse(url)
        if parsed.scheme or url.startswith("about:"):
            return url
        return f"https://{url}"

    def click(self, selector: str) -> dict[str, Any]:
        init = self.ensure_started()
        if not init.get("ok"):
            return init
        self._page.locator(selector).first.click()
        return {"ok": True, "clicked": selector, "url": self._page.url}

    def type(self, selector: str, text: str, clear: bool = True) -> dict[str, Any]:
        init = self.ensure_started()
        if not init.get("ok"):
            return init
        locator = self._page.locator(selector).first
        if clear:
            locator.fill("")
        locator.type(text)
        return {"ok": True, "typed": selector}

    def fill(self, selector: str, text: str) -> dict[str, Any]:
        init = self.ensure_started()
        if not init.get("ok"):
            return init
        self._page.locator(selector).first.fill(text)
        return {"ok": True, "filled": selector}

    def press(self, selector: str, key: str) -> dict[str, Any]:
        init = self.ensure_started()
        if not init.get("ok"):
            return init
        self._page.locator(selector).first.press(key)
        return {"ok": True, "pressed": key, "selector": selector}

    def wait_for_selector(self, selector: str, timeout_ms: int | None = None) -> dict[str, Any]:
        init = self.ensure_started()
        if not init.get("ok"):
            return init
        self._page.wait_for_selector(selector, timeout=timeout_ms)
        return {"ok": True, "selector": selector}

    def wait_for_timeout(self, timeout_ms: int) -> dict[str, Any]:
        init = self.ensure_started()
        if not init.get("ok"):
            return init
        self._page.wait_for_timeout(timeout_ms)
        return {"ok": True, "waited_ms": timeout_ms}

    def screenshot(self, path: str, full_page: bool = True) -> dict[str, Any]:
        init = self.ensure_started()
        if not init.get("ok"):
            return init
        out = Path(path)
        out.parent.mkdir(parents=True, exist_ok=True)
        self._page.screenshot(path=str(out), full_page=full_page)
        return {"ok": True, "screenshot": str(out.resolve())}

    def content(self) -> dict[str, Any]:
        init = self.ensure_started()
        if not init.get("ok"):
            return init
        return {"ok": True, "html": self._page.content(), "url": self._page.url, "title": self._page.title()}

    def text(self, selector: str) -> dict[str, Any]:
        init = self.ensure_started()
        if not init.get("ok"):
            return init
        value = self._page.locator(selector).first.inner_text()
        return {"ok": True, "selector": selector, "text": value}

    def evaluate(self, script: str, arg: Any = None) -> dict[str, Any]:
        init = self.ensure_started()
        if not init.get("ok"):
            return init
        result = self._page.evaluate(script, arg)
        return {"ok": True, "result": result}

    def scroll(self, x: int = 0, y: int = 800) -> dict[str, Any]:
        init = self.ensure_started()
        if not init.get("ok"):
            return init
        self._page.evaluate("([x,y]) => window.scrollBy(x,y)", [x, y])
        return {"ok": True, "scroll": {"x": x, "y": y}}

    def list_interactive_elements(self, max_items: int = 80) -> dict[str, Any]:
        init = self.ensure_started()
        if not init.get("ok"):
            return init
        script = """
() => {
  const nodes = Array.from(document.querySelectorAll('a,button,input,textarea,select,[role="button"],[role="link"],summary'));
  return nodes.slice(0, 300).map((el, i) => ({
    index: i,
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute('role') || '',
    type: el.getAttribute('type') || '',
    name: el.getAttribute('name') || '',
    id: el.id || '',
    classes: (el.className || '').toString().slice(0, 120),
    text: (el.innerText || el.value || '').replace(/\\s+/g, ' ').trim().slice(0, 120),
    href: el.getAttribute('href') || ''
  }));
}
"""
        items = self._page.evaluate(script) or []
        return {"ok": True, "elements": items[:max_items], "count": len(items)}

    def ui_tree(self, max_nodes: int = 200) -> dict[str, Any]:
        init = self.ensure_started()
        if not init.get("ok"):
            return init
        script = """
(maxNodes) => {
  const all = Array.from(document.querySelectorAll('body *')).slice(0, maxNodes);
  return all.map((el, idx) => ({
    index: idx,
    tag: el.tagName.toLowerCase(),
    id: el.id || '',
    role: el.getAttribute('role') || '',
    aria: el.getAttribute('aria-label') || '',
    text: (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 80),
    clickable: !!(el.closest('a,button,[role="button"],[onclick]') || el.matches('a,button,[role="button"],[onclick]')),
  }));
}
"""
        tree = self._page.evaluate(script, max_nodes) or []
        return {"ok": True, "tree": tree, "count": len(tree)}

    def detect_captcha(self) -> dict[str, Any]:
        init = self.ensure_started()
        if not init.get("ok"):
            return init
        script = """
() => {
  const text = (document.body ? document.body.innerText : '').toLowerCase();
  const suspects = [
    'captcha',
    'i am not a robot',
    'g-recaptcha',
    'hcaptcha',
    'cloudflare'
  ];
  const hitText = suspects.filter(s => text.includes(s));
  const hasIframe = !!document.querySelector('iframe[src*="recaptcha"], iframe[src*="hcaptcha"]');
  return { detected: hitText.length > 0 || hasIframe, hitText, hasIframe };
}
"""
        result = self._page.evaluate(script)
        return {"ok": True, "captcha": result}

    def run_steps(self, steps: list[dict[str, Any]]) -> dict[str, Any]:
        outcomes = []
        for idx, step in enumerate(steps, start=1):
            action = step.get("action")
            try:
                if action == "goto":
                    outcomes.append({"step": idx, **self.goto(step["url"], step.get("wait_until", "domcontentloaded"))})
                elif action == "click":
                    outcomes.append({"step": idx, **self.click(step["selector"])})
                elif action == "type":
                    outcomes.append(
                        {"step": idx, **self.type(step["selector"], step.get("text", ""), bool(step.get("clear", True)))}
                    )
                elif action == "fill":
                    outcomes.append({"step": idx, **self.fill(step["selector"], step.get("text", ""))})
                elif action == "press":
                    outcomes.append({"step": idx, **self.press(step["selector"], step["key"])})
                elif action == "wait_for_selector":
                    outcomes.append(
                        {
                            "step": idx,
                            **self.wait_for_selector(step["selector"], step.get("timeout_ms")),
                        }
                    )
                elif action == "wait":
                    outcomes.append({"step": idx, **self.wait_for_timeout(int(step.get("timeout_ms", 1000)))})
                elif action == "scroll":
                    outcomes.append({"step": idx, **self.scroll(int(step.get("x", 0)), int(step.get("y", 800)))})
                elif action == "screenshot":
                    outcomes.append(
                        {
                            "step": idx,
                            **self.screenshot(step.get("path", "agent_memory/screenshots/shot.png"), bool(step.get("full_page", True))),
                        }
                    )
                elif action == "content":
                    outcomes.append({"step": idx, **self.content()})
                elif action == "text":
                    outcomes.append({"step": idx, **self.text(step["selector"])})
                elif action == "elements":
                    outcomes.append({"step": idx, **self.list_interactive_elements(int(step.get("max_items", 80)))})
                elif action == "ui_tree":
                    outcomes.append({"step": idx, **self.ui_tree(int(step.get("max_nodes", 200)))})
                elif action == "detect_captcha":
                    outcomes.append({"step": idx, **self.detect_captcha()})
                elif action == "evaluate":
                    outcomes.append({"step": idx, **self.evaluate(step["script"], step.get("arg"))})
                else:
                    outcomes.append({"step": idx, "ok": False, "error": f"unknown action: {action}"})
            except Exception as exc:
                outcomes.append({"step": idx, "ok": False, "error": str(exc), "action": action})
        return {"ok": all(item.get("ok") for item in outcomes), "results": outcomes}

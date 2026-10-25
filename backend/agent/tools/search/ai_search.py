import datetime
import json
from pathlib import Path

from tools import browser
from tools.browser import BrowserSkill


CHAT_URL = "https://chatgpt.com/"
INPUT_SELECTORS = [
    "#prompt-textarea",
    ".ProseMirror",
]
RESPONSE_SCRIPT = """
() => {
    const chats = [];
    document.querySelectorAll('section[data-testid^="conversation-turn"]').forEach(section => {
        const role = section.getAttribute('data-turn');
        let text = '';
        if (role === 'user') {
            const el = section.querySelector('[data-message-author-role="user"] .whitespace-pre-wrap');
            text = el ? el.innerText : '';
        }
        if (role === 'assistant') {
            const el = section.querySelector('[data-message-author-role="assistant"] .markdown');
            text = el ? el.innerText : '';
        }
        chats.push({ role, text });
    });
    return chats;
}
"""


def _now_id() -> str:
    return datetime.datetime.now().strftime("%Y%m%d_%H%M%S")


def _pick_input(browser: BrowserSkill) -> str | None:
    for selector in INPUT_SELECTORS:
        result = browser.execute("wait_for_selector", selector=selector, timeout_ms=10000)
        if result.get("ok"):
            return selector
    return None


def _resolve_base_dir(memory_dir: str | Path | None, ts: str) -> Path:
    if memory_dir and str(memory_dir).strip() and str(memory_dir) != "(not started)":
        return Path(memory_dir)
    return Path("memory") / "chats" / f"ai-search_{ts}"


def _append_search_log(base_dir: Path, query: str, response: str):
    text_path = base_dir / "search_result.txt"
    with open(text_path, "a", encoding="utf-8") as handle:
        handle.write(f"\n\n--- Prompt ---\n{query}:\n--- Response ---\n{response}")


def ai_search(query: str, memory_dir: str | Path | None = None, browser: BrowserSkill | None = None) -> dict:
    if browser is None:
        browser = BrowserSkill()
    start_result = browser.execute("start")
    if not start_result.get("ok"):
        ts = _now_id()
        base_dir = _resolve_base_dir(memory_dir, ts)
        base_dir.mkdir(parents=True, exist_ok=True)
        error_msg = start_result.get("error", "Browser failed to start.")
        payload = {
            "ts": ts,
            "query": query,
            "chats": [],
            "latest_assistant_response": "",
            "error": error_msg,
            "start_result": start_result,
        }
        out_path = base_dir / f"chatgpt_{ts}.json"
        out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")
        _append_search_log(base_dir, query, error_msg)
        return {
            "ok": False,
            "error": error_msg,
            "path": str(out_path),
        }
    
    # Try to see if we are already in chatgpt, to keep conversation context if not closed
    url_check = browser.execute("evaluate", script="window.location.href").get("result", "")
    if "chatgpt.com" not in str(url_check):
        browser.execute("goto", url=CHAT_URL)
        
    ts = _now_id()
    base_dir = _resolve_base_dir(memory_dir, ts)
    base_dir.mkdir(parents=True, exist_ok=True)
    input_selector = _pick_input(browser)
    if not input_selector:
        page = browser.execute("content")
        raw_html = page.get("html", "")
        html_path = base_dir / f"chatgpt_{ts}.html"
        html_path.write_text(raw_html, encoding="utf-8")
        screenshot_path = base_dir / f"chatgpt_{ts}.png"
        browser.execute("screenshot", path=str(screenshot_path), full_page=True)
        error_msg = "Input box not found. Are you blocked by Cloudflare or login?"
        payload = {
            "ts": ts,
            "query": query,
            "chats": [],
            "latest_assistant_response": "",
            "error": error_msg,
            "raw_html_path": str(html_path),
            "screenshot_path": str(screenshot_path),
        }
        out_path = base_dir / f"chatgpt_{ts}.json"
        out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")
        _append_search_log(base_dir, query, error_msg)
        browser.execute("stop")
        return {
            "ok": False,
            "error": error_msg,
            "raw_html_path": str(html_path),
            "screenshot_path": str(screenshot_path),
            "path": str(out_path),
        }

    browser.execute("click", selector=input_selector)
    browser.execute("type", selector=input_selector, text=query, clear=True)
    
    # Try using the specific submit button if enter gets trapped.
    btn_click = browser.execute("click", selector='button[data-testid="send-button"]')
    if not btn_click.get("ok"):
        browser.execute("press", selector=input_selector, key="Enter")
    
    browser.execute("wait", timeout_ms=10000)

    # Wait additional time for streaming response to finish generating
    browser.execute("wait", timeout_ms=7000)

    chats = browser.execute("evaluate", script=RESPONSE_SCRIPT).get("result", [])
    
    # Get latest assistant response, or full array if no latest found
    response = ""
    if isinstance(chats, list) and chats:
        for chat in reversed(chats):
            if chat.get("role") == "assistant":
                response = chat.get("text", "")
                break
        if not response:
            response = str(chats)
    else:
        response = str(chats)
        
    if not response or response == "[]":
        page = browser.execute("content")
        response = page.get("html", "")[:2000]

    page = browser.execute("content")
    raw_html = page.get("html", "")
    html_path = base_dir / f"chatgpt_{ts}.html"
    html_path.write_text(raw_html, encoding="utf-8")
    out_path = base_dir / f"chatgpt_{ts}.json"
    payload = {
        "ts": ts,
        "query": query,
        "chats": chats,
        "latest_assistant_response": response,
        "raw_html_path": str(html_path),
    }
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")

    _append_search_log(base_dir, query, response)
        
    return {
        "ok": True,
        "query": query,
        "response": response,
        "path": str(out_path),
        "raw_html_path": str(html_path),
        "note": "Complete chat list pushed to JSON. Returned latest response."
    }

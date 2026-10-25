import datetime
import json
import re
from pathlib import Path
from urllib.parse import quote_plus

import requests

from core.brain.llm_cloud import run_llm



DEFAULT_ENGINES = [
    "https://html.duckduckgo.com/html/",
    "https://duckduckgo.com/html/",
    "https://duckduckgo.com/lite/",
]
DEFAULT_TIMEOUT = 20
_SESSION = requests.Session()


def _now_iso() -> str:
    return datetime.datetime.now().isoformat(timespec="seconds")


def _slugify(text: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9\s-]", " ", text).strip().lower()
    cleaned = re.sub(r"\s+", "-", cleaned)
    return cleaned[:60] or "general"


def _decide_context_dir(query: str, html_excerpt: str) -> str:
    prompt = (
        "Pick a short context label for the search query. "
        "Return ONLY a short kebab-case label like 'ai-tools' or 'music-history'.\n\n"
        f"Query: {query}\n"
        f"HTML excerpt: {html_excerpt[:500]}"
    )
    response = run_llm(prompt).strip()
    if response.startswith("[HF_API_ERROR]"):
        return _slugify(query)
    label = re.sub(r"[^a-zA-Z0-9-]", "", response.lower())
    if not label:
        return _slugify(query)
    return label[:60]


def _extract_results(html: str) -> list[dict]:
    results = []
    for match in re.finditer(r"result__a[^>]*href=\"([^\"]+)\"[^>]*>(.*?)<", html):
        url = match.group(1)
        title = re.sub(r"<.*?>", "", match.group(2))
        title = re.sub(r"\s+", " ", title).strip()
        if url and title:
            results.append({"title": title, "url": url})
        if len(results) >= 10:
            break
    return results


def _is_blocked(html: str) -> bool:
    text = html.lower()
    return "anomaly" in text or "duckduckgo.com/anomaly" in text


def _fetch_html(query: str) -> tuple[requests.Response | None, str, str]:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://duckduckgo.com/",
        "Connection": "keep-alive",
    }
    last_response = None
    last_html = ""
    last_engine = DEFAULT_ENGINES[0]
    for engine in DEFAULT_ENGINES:
        try:
            response = _SESSION.get(engine, params={"q": query}, headers=headers, timeout=DEFAULT_TIMEOUT)
        except requests.RequestException:
            continue
        html = response.text
        last_response, last_html, last_engine = response, html, engine
        if response.status_code == 200 and not _is_blocked(html):
            return response, html, engine
    return last_response, last_html, last_engine


def search(query: str) -> dict:
    response, html, engine = _fetch_html(query)
    results = _extract_results(html)
    blocked = _is_blocked(html)

    context_dir = _decide_context_dir(query, html)
    base_dir = Path("memory") / context_dir
    base_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    html_path = base_dir / f"raw_{ts}.html"
    html_path.write_text(html, encoding="utf-8", errors="replace")

    entry = {
        "ts": _now_iso(),
        "query": query,
        "engine": engine,
        "status_code": response.status_code if response else None,
        "blocked": blocked,
        "results": results,
        "raw_html": str(html_path),
    }

    log_path = base_dir / "search.jsonl"
    with open(log_path, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry, ensure_ascii=True) + "\n")

    return entry
import datetime
import difflib
import hashlib
import os
import subprocess
from pathlib import Path


def now_iso() -> str:
    return datetime.datetime.now().isoformat(timespec="seconds")


def timestamp_id() -> str:
    return datetime.datetime.now().strftime("%Y%m%d_%H%M%S")


def run_cmd(cmd: str, timeout: int = 45) -> str:
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return (result.stdout + result.stderr).strip()
    except subprocess.TimeoutExpired:
        return f"[TIMEOUT after {timeout}s]: {cmd[:60]}"
    except Exception as exc:
        return f"[ERROR] {exc}"


def read_file(path) -> str:
    try:
        return Path(path).read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""


def write_file(path, content: str):
    file_path = Path(path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content, encoding="utf-8")


def sha256_short(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()[:12]


def make_diff(old_content: str, new_content: str, label: str = "file") -> str:
    old_lines = old_content.splitlines(keepends=True)
    new_lines = new_content.splitlines(keepends=True)
    return "".join(
        difflib.unified_diff(
            old_lines,
            new_lines,
            fromfile=f"a/{label}",
            tofile=f"b/{label}",
        )
    )


def append_state_error(state: dict, error_type: str, msg: str):
    entry = {
        "ts": now_iso(),
        "type": error_type,
        "msg": msg,
        "task": state.get("current_task"),
        "iteration": state.get("iteration", 0),
    }
    state.setdefault("errors", []).append(entry)
    state["errors"] = state["errors"][-50:]


def restart_process(argv0: str, argv: list[str]):
    os.execv(argv0, [argv0] + argv)


def set_proxy(proxy_url: str):
    """Set HTTP and HTTPS proxy in environment variables."""
    os.environ["HTTP_PROXY"] = proxy_url
    os.environ["HTTPS_PROXY"] = proxy_url
    os.environ["http_proxy"] = proxy_url
    os.environ["https_proxy"] = proxy_url


def clear_proxy():
    """Clear proxy from environment variables."""
    for key in ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"]:
        os.environ.pop(key, None)

import os
import shutil
import subprocess
import time
from pathlib import Path
from core.brain.llm_cloud import run_llm


PROJECT_ROOT = Path(__file__).parent.parent.absolute()
_ACTIVE_PROCESS = None
_ACTIVE_CMD = None
_ACTIVE_START = None


def _active_status() -> dict:
    if not _ACTIVE_PROCESS:
        return {"ok": True, "status": "idle"}
    if _ACTIVE_PROCESS.poll() is None:
        return {
            "ok": True,
            "status": "running",
            "cmd": _ACTIVE_CMD,
            "pid": _ACTIVE_PROCESS.pid,
            "elapsed_s": round(time.time() - (_ACTIVE_START or time.time()), 1),
        }
    stdout, stderr = _ACTIVE_PROCESS.communicate()
    return {
        "ok": _ACTIVE_PROCESS.returncode == 0,
        "status": "completed",
        "cmd": _ACTIVE_CMD,
        "pid": _ACTIVE_PROCESS.pid,
        "elapsed_s": round(time.time() - (_ACTIVE_START or time.time()), 1),
        "stdout": (stdout or "").strip()[:4000],
        "stderr": (stderr or "").strip()[:4000],
        "returncode": _ACTIVE_PROCESS.returncode,
    }


def _clear_active():
    global _ACTIVE_PROCESS, _ACTIVE_CMD, _ACTIVE_START
    _ACTIVE_PROCESS = None
    _ACTIVE_CMD = None
    _ACTIVE_START = None

def is_safe_command(cmd: str) -> bool:
    lowered = cmd.lower()
    if ".env" in lowered:
        return False
    prompt = f"Command: {cmd}\nIs this command safe to execute in a sandboxed student environment? Reply with a JSON object containing 'is_safe' (boolean) and 'reason' (string)."
    result = run_llm(prompt).strip().upper()
    return "SAFE" in result and "UNSAFE" not in result

def execute_terminal(cmd: str) -> dict:
    global _ACTIVE_PROCESS, _ACTIVE_CMD, _ACTIVE_START
    control = cmd.strip().lower()
    if control in {"__status__", "terminal:status"}:
        status = _active_status()
        if status.get("status") == "completed":
            _clear_active()
        return status
    if control in {"__interrupt__", "terminal:interrupt"}:
        if _ACTIVE_PROCESS and _ACTIVE_PROCESS.poll() is None:
            _ACTIVE_PROCESS.terminate()
            return {"ok": True, "status": "terminated", "cmd": _ACTIVE_CMD, "pid": _ACTIVE_PROCESS.pid}
        _clear_active()
        return {"ok": True, "status": "idle"}

    if _ACTIVE_PROCESS and _ACTIVE_PROCESS.poll() is None:
        return _active_status()

    if _ACTIVE_PROCESS and _ACTIVE_PROCESS.poll() is not None:
        finished = _active_status()
        _clear_active()
        return finished

    if not is_safe_command(cmd):
        return {"ok": False, "error": "Command blocked: Security filter determined the command is unsafe"}

    try:
        bash_path = shutil.which("bash")
        env = os.environ.copy()
        
        if bash_path:
            proc = subprocess.Popen(
                [bash_path, "-c", cmd],
                cwd=str(PROJECT_ROOT),
                env=env,
                shell=False,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
        else:
            proc = subprocess.Popen(
                cmd,
                cwd=str(PROJECT_ROOT),
                env=env,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
            )

        _ACTIVE_PROCESS = proc
        _ACTIVE_CMD = cmd
        _ACTIVE_START = time.time()

        try:
            stdout, stderr = proc.communicate(timeout=120)
        except subprocess.TimeoutExpired:
            return _active_status()

        result = {
            "ok": proc.returncode == 0,
            "stdout": (stdout or "").strip()[:4000],
            "stderr": (stderr or "").strip()[:4000],
            "returncode": proc.returncode,
        }
        _clear_active()
        return result
    except Exception as exc:
        return {"ok": False, "error": str(exc)}

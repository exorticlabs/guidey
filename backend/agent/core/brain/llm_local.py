import json
import re
import urllib.error
import urllib.request

from ..config import HF_MODELS, LS_MODELS, OLLAMA_MODELS
from ..utils import append_state_error, run_cmd

LM_STUDIO_URL = "http://localhost:1234/v1"

ACTIVE_MODEL = None


def resolve_model() -> str:
    global ACTIVE_MODEL
    if ACTIVE_MODEL:
        return ACTIVE_MODEL

    lmstudio_ok = _lmstudio_list_models()
    if lmstudio_ok:
        available = {item.get("id", "") for item in lmstudio_ok}
        for model_name in LS_MODELS:
            if model_name in available:
                ACTIVE_MODEL = f"lmstudio:{model_name}"
                print(f"[MODEL] Using LM Studio: {model_name}")
                return ACTIVE_MODEL
        if LS_MODELS:
            ACTIVE_MODEL = f"lmstudio:{LS_MODELS[0]}"
            print(f"[MODEL] Using LM Studio: {LS_MODELS[0]}")
            return ACTIVE_MODEL

    ollama_ok = run_cmd("ollama list 2>&1", timeout=10)
    if "Error" not in ollama_ok and "not found" not in ollama_ok.lower():
        available = ollama_ok.lower()
        for model_name in OLLAMA_MODELS:
            if model_name.split(":")[0].lower() in available or model_name.lower() in available:
                ACTIVE_MODEL = f"ollama:{model_name}"
                print(f"[MODEL] Using ollama: {model_name}")
                return ACTIVE_MODEL

        print(f"[MODEL] Pulling {OLLAMA_MODELS[0]} via ollama...")
        run_cmd(f"ollama pull {OLLAMA_MODELS[0]}", timeout=300)
        ACTIVE_MODEL = f"ollama:{OLLAMA_MODELS[0]}"
        return ACTIVE_MODEL

    print("[MODEL] Ollama unavailable — trying HuggingFace transformers...")
    try:
        import transformers  # noqa: F401

        ACTIVE_MODEL = f"hf:{HF_MODELS[0]}"
        print(f"[MODEL] Using HuggingFace: {HF_MODELS[0]}")
        return ACTIVE_MODEL
    except ImportError:
        print("[MODEL] Installing transformers...")
        run_cmd("pip install transformers torch --break-system-packages -q", timeout=300)
        ACTIVE_MODEL = f"hf:{HF_MODELS[0]}"
        return ACTIVE_MODEL


def run_llm(prompt: str, state: dict | None = None, system_prompt: str | None = None, tools: list[dict] | None = None, **kwargs) -> str | dict:
    model = resolve_model()
    if state:
        state["stats"]["llm_calls"] += 1

    merged_prompt = prompt
    if system_prompt and not model.startswith("lmstudio:"):
        merged_prompt = f"{system_prompt}\n\n{prompt}"

    if model.startswith("ollama:"):
        selected = model[7:]
        safe = merged_prompt.replace("\\", "\\\\").replace('"', '\\"').replace("`", "\\`").replace("$", "\\$")
        return run_cmd(f'ollama run {selected} "{safe}"', timeout=240)

    if model.startswith("lmstudio:"):
        selected = model[9:]
        return lmstudio_chat(selected, prompt, system_prompt=system_prompt, tools=tools)

    if model.startswith("hf:"):
        selected = model[3:]
        return hf_infer(selected, merged_prompt)

    return "[ERROR] No model available"


def _lmstudio_request(path: str, payload: dict | None = None) -> dict | None:
    url = f"{LM_STUDIO_URL}{path}"
    data = None
    headers = {"Content-Type": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if data else "GET")
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw)
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError):
        return None


def _lmstudio_list_models() -> list[dict] | None:
    result = _lmstudio_request("/models")
    if not result:
        return None
    return result.get("data") or []


def lmstudio_chat(model_name: str, prompt: str, system_prompt: str | None = None, tools: list[dict] | None = None) -> str | dict:
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": model_name,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 1024,
    }
    if tools:
        payload["tools"] = tools

    result = _lmstudio_request("/chat/completions", payload)
    if not result:
        return "[LM_STUDIO_ERROR] No response"

    try:
        msg = result["choices"][0]["message"]
        content = msg.get("content")
        tool_calls = msg.get("tool_calls")
        
        if tools is not None:
            return {
                "content": str(content).strip() if content else "",
                "tool_calls": tool_calls or []
            }
        elif content:
            return str(content).strip()
    except (KeyError, IndexError, TypeError):
        return "[LM_STUDIO_ERROR] Invalid response"


def hf_infer(model_name: str, prompt: str) -> str:
    try:
        from transformers import pipeline

        pipe = pipeline("text-generation", model=model_name, max_new_tokens=1024)
        result = pipe(prompt, do_sample=True, temperature=0.7)
        return result[0]["generated_text"][len(prompt) :].strip()
    except Exception as exc:
        return f"[HF_ERROR] {exc}"


def parse_json_response(raw: str, state: dict, context: str = "") -> dict | None:
    cleaned = re.sub(r"```(?:json)?", "", raw).replace("```", "").strip()
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError as exc:
            append_state_error(state, "JSON_PARSE", f"{exc} in {context}: {cleaned[:200]}")
    else:
        append_state_error(state, "JSON_MISSING", f"No JSON in {context}: {raw[:200]}")
    return None
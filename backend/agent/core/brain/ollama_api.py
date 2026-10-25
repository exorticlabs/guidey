"""
Ollama API — Chat completions via Ollama-compatible endpoints.

Supports both legacy (prompt + system_prompt) and new (messages array)
calling conventions.
"""

import json
import os
import urllib.error
import urllib.request
from typing import Any
from ..config import OLLAMA_MODEL as _CONFIGURED_MODEL

OLLAMA_BASE = os.environ.get("OLLAMA_BASE", "https://ollama.com/api")
OLLAMA_MODEL = _CONFIGURED_MODEL
OLLAMA_TIMEOUT = int(os.environ.get("OLLAMA_TIMEOUT", "120"))


API_KEYS = [
	os.environ.get("OLLAMA_API_KEY"),
	os.environ.get("OLLAMA_API_KEY_2"),
	os.environ.get("OLLAMA_API_KEY_3"),
	os.environ.get("OLLAMA_API_KEY_4")
]
API_KEYS = [k for k in API_KEYS if k]

CURRENT_KEY_INDEX = 0

def get_current_api_key() -> str | None:
	global CURRENT_KEY_INDEX
	if not API_KEYS:
		return None
	return API_KEYS[CURRENT_KEY_INDEX]

def rotate_api_key():
	global CURRENT_KEY_INDEX
	if not API_KEYS:
		return
	prev = CURRENT_KEY_INDEX
	CURRENT_KEY_INDEX = (CURRENT_KEY_INDEX + 1) % len(API_KEYS)
	print(f"[Ollama API] Rotating API key from index {prev} to {CURRENT_KEY_INDEX}")

def _headers(api_key: str | None = None) -> dict:
	headers = {"Content-Type": "application/json"}
	key = api_key or get_current_api_key()
	if key:
		headers["Authorization"] = f"Bearer {key}"
	return headers


def _request_json(path: str, payload: dict | None = None, method: str = "POST", api_key: str | None = None) -> dict | str:
	data = json.dumps(payload).encode("utf-8") if payload is not None else None
	request = urllib.request.Request(
		f"{OLLAMA_BASE}{path}",
		data=data,
		headers=_headers(api_key),
		method=method,
	)
	try:
		with urllib.request.urlopen(request, timeout=OLLAMA_TIMEOUT) as response:
			raw = response.read().decode("utf-8", errors="replace")
	except urllib.error.HTTPError as exc:
		try:
			details = exc.read().decode("utf-8", errors="replace")
		except Exception:
			details = str(exc)
		return f"[OLLAMA_ERROR] {details[:400]}"
	except TimeoutError:
		return f"[OLLAMA_ERROR] Request timed out after {OLLAMA_TIMEOUT} seconds."
	except urllib.error.URLError as exc:
		if isinstance(exc.reason, TimeoutError):
			return f"[OLLAMA_ERROR] Request timed out."
		return f"[OLLAMA_ERROR] {exc}"
	except Exception as exc:
		return f"[OLLAMA_ERROR] Unexpected error: {exc}"

	try:
		return json.loads(raw)
	except json.JSONDecodeError:
		return f"[OLLAMA_ERROR] invalid json: {raw[:400]}"


def health() -> dict | str:
	return _request_json("/version", payload=None, method="GET")


def list_models() -> dict | str:
	return _request_json("/tags", payload=None, method="GET")


def show_model(model_name: str) -> dict | str:
	return _request_json("/show", payload={"name": model_name})


def pull_model(model_name: str) -> dict | str:
	return _request_json("/pull", payload={"name": model_name, "stream": False})


def _clean_messages_for_payload(messages: list[dict]) -> list[dict]:
	"""
	Strip cache_control and other non-standard fields from messages
	before sending to Ollama (which doesn't support them natively).
	"""
	cleaned = []
	for msg in messages:
		clean_msg = {
			"role": msg.get("role", "user"),
			"content": msg.get("content", ""),
		}
		cleaned.append(clean_msg)
	return cleaned


def ollama_chat(
	prompt: str | None = None,
	model_name: str | None = None,
	temperature: float = 0.7,
	system_prompt: str | None = None,
	tools: list[dict] | None = None,
	messages: list[dict] | None = None,
	max_new_tokens: int | None = None,
	**kwargs,
) -> str | dict:
	"""
	Send a chat completion request to Ollama.

	Supports two calling conventions:
	  - Legacy: ollama_chat(prompt="...", system_prompt="...")
	  - New:    ollama_chat(messages=[...])

	When `messages` is provided, `prompt` and `system_prompt` are ignored.
	"""
	selected = model_name or OLLAMA_MODEL

	# Build messages array
	if messages is not None:
		# New path: messages provided directly
		chat_messages = _clean_messages_for_payload(messages)
	else:
		# Legacy path: build from prompt + system_prompt
		chat_messages = []
		if system_prompt:
			chat_messages.append({"role": "system", "content": system_prompt})
		chat_messages.append({"role": "user", "content": prompt or ""})

	options = {"temperature": temperature}
	if max_new_tokens is not None:
		options["num_predict"] = max_new_tokens

	payload = {
		"model": selected,
		"messages": chat_messages,
		"stream": False,
		"options": options,
	}
	if tools:
		payload["tools"] = tools
		
	# Try keys dynamically on rate limit (429) or auth (401) failures
	max_attempts = max(1, len(API_KEYS))
	data = None
	for attempt in range(max_attempts):
		current_key = get_current_api_key()
		data = _request_json("/chat", payload=payload, api_key=current_key)
		
		is_failed = False
		if isinstance(data, str) and data.startswith("[OLLAMA_ERROR]"):
			err_lower = data.lower()
			if "429" in err_lower or "401" in err_lower or "unauthorized" in err_lower or "rate limit" in err_lower or "too many requests" in err_lower or "quota" in err_lower:
				is_failed = True
				
		if is_failed:
			rotate_api_key()
			continue
		else:
			break

	if isinstance(data, str):
		return data

	message = data.get("message") if isinstance(data, dict) else None
	if isinstance(message, dict):
		content = message.get("content")
		tool_calls = message.get("tool_calls")
		
		if tools is not None:
			return {
				"content": str(content).strip() if content else "",
				"tool_calls": tool_calls or []
			}
		elif content:
			return str(content).strip()

	return f"[OLLAMA_ERROR] unexpected response: {json.dumps(data)[:400]}"


def run_llm(
	prompt: str | None = None,
	model_name: str | None = None,
	system_prompt: str | None = None,
	tools: list[dict] | None = None,
	messages: list[dict] | None = None,
	tool_choice: Any = None,
	max_new_tokens: int | None = None,
	**kwargs,
) -> str | dict:
	return ollama_chat(
		prompt=prompt,
		model_name=model_name,
		system_prompt=system_prompt,
		tools=tools,
		messages=messages,
		max_new_tokens=max_new_tokens,
		**kwargs,
	)

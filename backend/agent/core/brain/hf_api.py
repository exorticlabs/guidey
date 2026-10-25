"""
HuggingFace Router API — Chat completions via HF inference endpoints.

Supports both legacy (prompt + system_prompt) and new (messages array)
calling conventions.
"""

import json
import os
import urllib.error
import urllib.request
from typing import Any

from ..config import HF_MODELS

HF_ROUTER_BASE = os.environ.get("HF_ROUTER_BASE", "https://router.huggingface.co/v1")
HF_API_TOKEN = os.environ.get("HF_API_TOKEN") or os.environ.get("HUGGINGFACEHUB_API_TOKEN")
HF_DEFAULT_TIMEOUT = int(os.environ.get("HF_API_TIMEOUT", "60"))

def _hf_headers() -> dict:
	headers = {"Content-Type": "application/json"}
	if HF_API_TOKEN:
		headers["Authorization"] = f"Bearer {HF_API_TOKEN}"
	return headers


def _clean_messages_for_payload(messages: list[dict]) -> list[dict]:
	"""
	Strip non-standard fields (cache_control etc.) from messages
	before sending to HF API.
	"""
	cleaned = []
	for msg in messages:
		clean_msg = {
			"role": msg.get("role", "user"),
			"content": msg.get("content", ""),
		}
		cleaned.append(clean_msg)
	return cleaned


def hf_api_infer(
	prompt: str | None = None,
	model_name: str | None = None,
	max_new_tokens: int = 2048,
	temperature: float = 0.7,
	top_p: float = 0.95,
	stop: list[str] | None = None,
	system_prompt: str | None = None,
	tools: list[dict] | None = None,
	messages: list[dict] | None = None,
	tool_choice: Any = None,
) -> str | dict:
	"""
	Send a chat completion request to HuggingFace.

	Supports two calling conventions:
	  - Legacy: hf_api_infer(prompt="...", system_prompt="...")
	  - New:    hf_api_infer(messages=[...])

	When `messages` is provided, `prompt` and `system_prompt` are ignored.
	"""
	selected = model_name or (HF_MODELS[0] if HF_MODELS else "Qwen/Qwen2.5-72B-Instruct")

	# Build messages array
	if messages is not None:
		chat_messages = _clean_messages_for_payload(messages)
	else:
		chat_messages = []
		if system_prompt:
			chat_messages.append({"role": "system", "content": system_prompt})
		chat_messages.append({"role": "user", "content": prompt or ""})

	payload = {
		"model": selected,
		"messages": chat_messages,
		"max_tokens": max_new_tokens,
		"temperature": temperature,
		"top_p": top_p,
	}
	if stop:
		payload["stop"] = stop
	if tools:
		payload["tools"] = tools
		if tool_choice:
			payload["tool_choice"] = tool_choice

	url = f"{HF_ROUTER_BASE}/chat/completions"
	data = json.dumps(payload).encode("utf-8")
	request = urllib.request.Request(url, data=data, headers=_hf_headers(), method="POST")

	try:
		with urllib.request.urlopen(request, timeout=HF_DEFAULT_TIMEOUT) as response:
			raw = response.read().decode("utf-8", errors="replace")
	except urllib.error.HTTPError as exc:
		try:
			details = exc.read().decode("utf-8", errors="replace")
		except Exception:
			details = str(exc)
		return f"[HF_API_ERROR] {details[:400]}"
	except urllib.error.URLError as exc:
		return f"[HF_API_ERROR] {exc}"

	try:
		data = json.loads(raw)
	except json.JSONDecodeError:
		return f"[HF_API_ERROR] invalid json: {raw[:400]}"

	if isinstance(data, dict) and "error" in data:
		return f"[HF_API_ERROR] {data['error']}"

	if isinstance(data, dict):
		choices = data.get("choices") or []
		if choices and isinstance(choices[0], dict):
			message = choices[0].get("message") or {}
			content = message.get("content")
			tool_calls = message.get("tool_calls")
			
			if tools is not None:
				return {
					"content": str(content).strip() if content else "",
					"tool_calls": tool_calls or []
				}
			elif content:
				return str(content).strip()

	return f"[HF_API_ERROR] unexpected response: {raw[:400]}"


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
	if not HF_API_TOKEN:
		return "[HF_API_ERROR] Missing HF_API_TOKEN or HUGGINGFACEHUB_API_TOKEN"
	call_kwargs = {
		"prompt": prompt,
		"model_name": model_name,
		"system_prompt": system_prompt,
		"tools": tools,
		"messages": messages,
		"tool_choice": tool_choice,
	}
	if max_new_tokens is not None:
		call_kwargs["max_new_tokens"] = max_new_tokens
	call_kwargs.update(kwargs)
	return hf_api_infer(**call_kwargs)


def test_hf_request(prompt: str = "Hello from guiedteach") -> dict:
	response = run_llm(prompt=prompt)
	return {
		"ok": not response.startswith("[HF_API_ERROR]"),
		"model": HF_MODELS[0] if HF_MODELS else "Qwen/Qwen2.5-72B-Instruct",
		"response": response,
	}

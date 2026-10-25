"""
LLM Cloud Router — Routes LLM calls to the configured provider.

Supports both legacy (prompt string) and new (messages array) calling
conventions. New code should always pass messages.
"""

import os
from typing import Any
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_result

from ..config import LLM_PROVIDER, LLM_PROVIDER_ORDER
from . import hf_api
from . import ollama_api
from . import llm_local


def _normalize_provider(value: str) -> str:
	return value.strip().lower()


def _provider_order() -> list[str]:
	env_order = os.environ.get("LLM_PROVIDER_ORDER")

	if env_order:
		return [
			_normalize_provider(item)
			for item in env_order.split(",")
			if item.strip()
		]

	return [_normalize_provider(item) for item in LLM_PROVIDER_ORDER]


def _provider_name() -> str:
	return _normalize_provider(
		os.environ.get("LLM_PROVIDER", LLM_PROVIDER)
	)

def should_retry_llm(result):
	if isinstance(result, str) and ("[HF_API_ERROR]" in result or "[OLLAMA_ERROR]" in result):
		# Retry on rate limit or server errors
		if "429" in result or "503" in result or "500" in result or "502" in result or "504" in result:
			print(f"[LLM Cloud] Retrying LLM call due to rate limit/server error: {result[:100]}")
			return True
	return False


@retry(wait=wait_exponential(multiplier=1, min=2, max=10), stop=stop_after_attempt(5), retry=retry_if_result(should_retry_llm))
def run_llm(
	prompt: str | None = None,
	model_name: str | None = None,
	system_prompt: str | None = None,
	tools: list[dict] | None = None,
	messages: list[dict] | None = None,
	tool_choice: Any = None,
	max_new_tokens: int | None = None,
	**extra_kwargs,
) -> str | dict:
	"""
	Route an LLM call to the configured provider.

	Supports two calling conventions:
	  - Legacy: run_llm(prompt="...", system_prompt="...")
	  - New:    run_llm(messages=[...])

	If `messages` is provided, it takes priority. `prompt` and `system_prompt`
	are ignored when `messages` is present.
	"""
	provider = _provider_name()

	# Build kwargs for provider calls
	kwargs: dict[str, Any] = {
		"model_name": model_name,
		"tools": tools,
	}
	if max_new_tokens is not None:
		kwargs["max_new_tokens"] = max_new_tokens
	kwargs.update(extra_kwargs)
	if tool_choice:
		kwargs["tool_choice"] = tool_choice

	if messages is not None:
		kwargs["messages"] = messages
	else:
		kwargs["prompt"] = prompt or ""
		kwargs["system_prompt"] = system_prompt

	if provider == "hf":
		return hf_api.run_llm(**kwargs)

	if provider == "ollama":
		return ollama_api.run_llm(**kwargs)

	if provider == "local":
		# llm_local doesn't support messages yet — convert
		local_kwargs = dict(kwargs)
		local_kwargs.pop("model_name", None)
		if "messages" in local_kwargs:
			# Flatten messages to prompt for local
			msgs = local_kwargs.pop("messages")
			local_kwargs["prompt"] = _messages_to_prompt(msgs)
			local_kwargs["system_prompt"] = None
		return llm_local.run_llm(**local_kwargs)

	if provider == "auto":

		for option in _provider_order():
			if option == "hf":
				response = hf_api.run_llm(**kwargs)

				if isinstance(response, dict) or not response.startswith("[HF_API_ERROR]"):
					return response

			if option == "ollama":
				response = ollama_api.run_llm(**kwargs)

				if isinstance(response, dict) or not response.startswith("[OLLAMA_ERROR]"):
					return response

			if option == "local":
				local_kwargs = dict(kwargs)
				local_kwargs.pop("model_name", None)
				if "messages" in local_kwargs:
					msgs = local_kwargs.pop("messages")
					local_kwargs["prompt"] = _messages_to_prompt(msgs)
					local_kwargs["system_prompt"] = None
				response = llm_local.run_llm(**local_kwargs)

				if isinstance(response, dict) or not response.startswith("[HF_ERROR]"):
					return response

		return "[LLM_ERROR] No provider succeeded"

	return "[LLM_ERROR] Unknown provider"


def _messages_to_prompt(messages: list[dict]) -> str:
	"""Flatten a messages array to a single prompt string (fallback for local)."""
	parts = []
	for msg in messages:
		role = msg.get("role", "user").upper()
		content = msg.get("content", "")
		parts.append(f"{role}: {content}")
	return "\n\n".join(parts)
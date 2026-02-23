"""
Deterministic Ollama API client. No global state.
Logs decoding parameters; returns raw text only; raises structured errors.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import requests

logger = logging.getLogger(__name__)

CLIENT_VERSION = "1.0"


class OllamaError(Exception):
    """Structured Ollama call failure."""

    def __init__(self, message: str, status_code: int | None = None, response_text: str | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_text = response_text


def call_ollama(
    prompt: str,
    model_name: str,
    *,
    temperature: float,
    top_p: float,
    top_k: int,
    repeat_penalty: float,
    seed: int,
    max_tokens: int,
    base_url: str = "http://localhost:11434",
    timeout_seconds: int = 120,
) -> str:
    """
    Single deterministic completion. Resets conversation per call (no chat history).
    Returns raw response text only. Raises OllamaError on failure.
    """
    url = f"{base_url.rstrip('/')}/api/generate"
    payload: dict[str, Any] = {
        "model": model_name,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
            "top_p": top_p,
            "top_k": top_k,
            "repeat_penalty": repeat_penalty,
            "seed": seed,
            "num_predict": max_tokens,
        },
    }
    logger.debug(
        "Ollama request params: model=%s temperature=%s top_p=%s top_k=%s repeat_penalty=%s seed=%s max_tokens=%s",
        model_name,
        temperature,
        top_p,
        top_k,
        repeat_penalty,
        seed,
        max_tokens,
    )
    try:
        resp = requests.post(url, json=payload, timeout=timeout_seconds)
    except requests.exceptions.Timeout as e:
        raise OllamaError(
            f"Ollama request timed out after {timeout_seconds}s",
            response_text=str(e),
        ) from e
    except requests.exceptions.RequestException as e:
        raise OllamaError(f"Ollama request failed: {e}", response_text=str(e)) from e

    if resp.status_code != 200:
        raise OllamaError(
            f"Ollama returned status {resp.status_code}",
            status_code=resp.status_code,
            response_text=resp.text[:1000] if resp.text else None,
        )

    try:
        data = resp.json()
    except json.JSONDecodeError as e:
        raise OllamaError(
            f"Ollama response was not valid JSON: {e}",
            status_code=resp.status_code,
            response_text=resp.text[:1000] if resp.text else None,
        ) from e

    if "response" not in data:
        raise OllamaError(
            "Ollama response missing 'response' field",
            status_code=200,
            response_text=json.dumps(data)[:1000],
        )

    return data["response"] if isinstance(data["response"], str) else str(data["response"])


def call_ollama_with_retries(
    prompt: str,
    model_name: str,
    *,
    temperature: float,
    top_p: float,
    top_k: int,
    repeat_penalty: float,
    seed: int,
    max_tokens: int,
    base_url: str = "http://localhost:11434",
    timeout_seconds: int = 120,
    max_retries: int = 3,
) -> str:
    """
    Call Ollama with up to max_retries attempts. Raises OllamaError if all fail.
    """
    last_err: Exception | None = None
    for attempt in range(max_retries):
        try:
            return call_ollama(
                prompt=prompt,
                model_name=model_name,
                temperature=temperature,
                top_p=top_p,
                top_k=top_k,
                repeat_penalty=repeat_penalty,
                seed=seed,
                max_tokens=max_tokens,
                base_url=base_url,
                timeout_seconds=timeout_seconds,
            )
        except OllamaError as e:
            last_err = e
            if attempt < max_retries - 1:
                logger.warning("Ollama attempt %s failed, retrying: %s", attempt + 1, e)
    raise last_err  # type: ignore

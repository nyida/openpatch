"""
CORTEX Layer 2: Multi-Model Inference Engine.
Runs multiple Ollama models on the same prompt and returns response text, latency, token count.
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import httpx

OLLAMA_BASE = "http://localhost:11434"
DEFAULT_MODELS = ["llama3", "mistral", "phi", "gemma"]


@dataclass
class ModelResponse:
    model: str
    output: str
    latency_ms: float
    token_count: int | None
    raw: dict[str, Any] | None = None


async def call_ollama_generate(
    client: httpx.AsyncClient,
    model: str,
    prompt: str,
    *,
    base_url: str = OLLAMA_BASE,
    timeout: float = 120.0,
) -> ModelResponse:
    url = f"{base_url.rstrip('/')}/api/generate"
    payload = {"model": model, "prompt": prompt, "stream": False}
    start = time.perf_counter()
    resp = await client.post(url, json=payload, timeout=timeout)
    resp.raise_for_status()
    elapsed_ms = (time.perf_counter() - start) * 1000
    data = resp.json()
    text = data.get("response", "") or ""
    token_count = data.get("eval_count") or data.get("response", "").count(" ") + 1
    return ModelResponse(
        model=model,
        output=text.strip(),
        latency_ms=round(elapsed_ms, 2),
        token_count=token_count,
        raw=data,
    )


async def run_multi_model_inference(
    prompt: str,
    *,
    models: list[str] | None = None,
    base_url: str = OLLAMA_BASE,
    timeout: float = 120.0,
) -> list[ModelResponse]:
    """Execute all models on the same prompt. Returns list of ModelResponse."""
    models = models or DEFAULT_MODELS
    results: list[ModelResponse] = []
    async with httpx.AsyncClient() as client:
        for model in models:
            try:
                r = await call_ollama_generate(client, model, prompt, base_url=base_url, timeout=timeout)
                results.append(r)
            except Exception as e:
                results.append(
                    ModelResponse(
                        model=model,
                        output=f"[Error: {e!s}]",
                        latency_ms=0.0,
                        token_count=None,
                        raw=None,
                    )
                )
    return results

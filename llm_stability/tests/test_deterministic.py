"""
Deterministic verification: rerun 5 deterministic Ollama calls and assert byte-identical output.
Requires Ollama running with a model that supports seed (e.g. temperature=0).
"""

from __future__ import annotations

import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from src.ollama_client import call_ollama
from src.utils import load_yaml


def test_deterministic_verification(config_path: str | None = None) -> bool:
    """
    Run 5 deterministic calls twice each; assert byte-identical output.
    Returns True if all match; raises AssertionError otherwise.
    """
    config_path = config_path or str(_root / "configs" / "main.yaml")
    config = load_yaml(config_path)
    models_cfg = config["models"]
    decoding = config["decoding"]
    ollama_cfg = config.get("ollama", {})
    base_url = ollama_cfg.get("base_url", "http://localhost:11434")
    timeout = ollama_cfg.get("timeout_seconds", 60)

    # 5 (model, prompt, seed) combinations
    prompts = ["What is 2+2? ANSWER: <value>", "Capital of France? A) London B) Paris. ANSWER: <value>"]
    n_calls = 5
    results_first: list[str] = []
    results_second: list[str] = []

    for i in range(n_calls):
        model_cfg = models_cfg[i % len(models_cfg)]
        ollama_id = model_cfg["ollama_identifier"]
        prompt = prompts[i % len(prompts)]
        seed = 42 + i * 1000
        out1 = call_ollama(
            prompt=prompt,
            model_name=ollama_id,
            temperature=0.0,
            top_p=decoding["top_p"],
            top_k=decoding["top_k"],
            repeat_penalty=decoding["repeat_penalty"],
            seed=seed,
            max_tokens=decoding["max_tokens"],
            base_url=base_url,
            timeout_seconds=timeout,
        )
        results_first.append(out1)
        out2 = call_ollama(
            prompt=prompt,
            model_name=ollama_id,
            temperature=0.0,
            top_p=decoding["top_p"],
            top_k=decoding["top_k"],
            repeat_penalty=decoding["repeat_penalty"],
            seed=seed,
            max_tokens=decoding["max_tokens"],
            base_url=base_url,
            timeout_seconds=timeout,
        )
        results_second.append(out2)
        assert out1 == out2, f"Call {i}: output mismatch (seed={seed})"
    return True


if __name__ == "__main__":
    try:
        test_deterministic_verification()
        print("Deterministic verification passed: 5/5 calls byte-identical on rerun.")
    except Exception as e:
        print(f"Deterministic verification failed: {e}")
        sys.exit(1)

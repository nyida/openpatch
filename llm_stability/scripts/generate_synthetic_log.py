"""
Generate a small synthetic responses.jsonl for testing the scoring/analysis pipeline
without running Ollama. Responses follow ANSWER: <value> format.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from src.prompt_loader import load_prompts
from src.utils import load_yaml, deterministic_seed

def main() -> None:
    config = load_yaml(_root / "configs" / "main.yaml")
    prompts_path = _root / "prompts" / "prompts.json"
    log_path = _root / config["output"]["log_path"]
    prompts = load_prompts(prompts_path)
    models_cfg = config["models"]
    decoding = config["decoding"]
    n_samples = config.get("stochastic", {}).get("n_samples", 3)

    log_path.parent.mkdir(parents=True, exist_ok=True)
    with open(log_path, "w", encoding="utf-8") as f:
        for model_cfg in models_cfg:
            model_name = model_cfg["name"]
            for base in prompts:
                base_id = base["base_id"]
                gt = base["ground_truth"]
                for par in base["paraphrases"]:
                    variant_id = par["variant_id"]
                    for temp in decoding["temperature_values"]:
                        for t in range(n_samples):
                            seed = deterministic_seed(model_name, base_id, variant_id, temp, t)
                            response = f"ANSWER: {gt}"
                            record = {
                                "model": model_name,
                                "model_hash": model_cfg["ollama_identifier"],
                                "base_id": base_id,
                                "variant_id": variant_id,
                                "task": base["task"],
                                "temperature": temp,
                                "sample_index": t,
                                "seed": seed,
                                "prompt": par["text"],
                                "response": response,
                                "timestamp": "2025-01-01T12:00:00Z",
                                "ollama_version": "synthetic",
                                "client_version": "1.0",
                                "failure": None,
                                "git_commit": None,
                            }
                            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    print(f"Wrote synthetic log: {log_path}")


if __name__ == "__main__":
    main()

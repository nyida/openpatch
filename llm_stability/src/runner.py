"""
Experiment runner: for each model, base item, paraphrase, temperature, sample —
call Ollama with deterministic seed, log full record to JSONL. Crash recovery: skip existing.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from tqdm import tqdm

from src.ollama_client import OllamaError, call_ollama_with_retries
from src.prompt_loader import load_prompts
from src.utils import deterministic_seed, ensure_dir, get_git_commit_hash, load_yaml

logger = logging.getLogger(__name__)

CLIENT_VERSION = "1.0"


def _log_record(record: dict[str, Any], log_path: Path) -> None:
    """Append single JSON object as one line to JSONL file."""
    ensure_dir(log_path.parent)
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def _existing_keys(log_path: Path) -> set[str]:
    """Return set of (model, base_id, variant_id, temperature, seed) keys already in log."""
    out: set[str] = set()
    if not log_path.exists():
        return out
    with open(log_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
                k = (
                    rec.get("model", ""),
                    rec.get("base_id", ""),
                    rec.get("variant_id", ""),
                    rec.get("temperature"),
                    rec.get("seed"),
                )
                out.add(str(k))
            except json.JSONDecodeError:
                continue
    return out


def _get_ollama_version(base_url: str) -> str:
    """Fetch Ollama version from /api/version or return 'unknown'."""
    try:
        import requests
        r = requests.get(f"{base_url.rstrip('/')}/api/version", timeout=5)
        if r.status_code == 200:
            d = r.json()
            return d.get("version", "unknown")
    except Exception:
        pass
    return "unknown"


def run_experiment(config_path: str) -> None:
    """
    Load config and prompts; run all (model, base, paraphrase, temp, sample) combinations;
    log each record to JSONL immediately. Skip entries already in log (crash recovery).
    """
    config = load_yaml(config_path)
    config_dir = Path(config_path).resolve().parent.parent
    prompts_path = config_dir / "prompts" / "prompts.json"
    log_path = config_dir / config["output"]["log_path"]
    models_cfg = config["models"]
    decoding = config["decoding"]
    stochastic = config.get("stochastic", {})
    n_samples = stochastic.get("n_samples", 3)
    ollama_cfg = config.get("ollama", {})
    base_url = ollama_cfg.get("base_url", "http://localhost:11434")
    timeout = ollama_cfg.get("timeout_seconds", 120)
    max_retries = ollama_cfg.get("max_retries", 3)
    client_version = config.get("reproducibility", {}).get("client_version", CLIENT_VERSION)

    prompts = load_prompts(prompts_path)
    existing = _existing_keys(log_path)
    ollama_version = _get_ollama_version(base_url)
    git_hash = get_git_commit_hash(config_dir)

    work: list[tuple[dict, dict, dict, float, int]] = []
    for model_cfg in models_cfg:
        for base in prompts:
            for par in base["paraphrases"]:
                for temp in decoding["temperature_values"]:
                    for t in range(n_samples):
                        work.append((model_cfg, base, par, temp, t))

    skipped = 0
    for model_cfg, base, par, temp, t in work:
        model_name = model_cfg["name"]
        base_id = base["base_id"]
        variant_id = par["variant_id"]
        seed = deterministic_seed(model_name, base_id, variant_id, temp, t)
        key = str((model_name, base_id, variant_id, temp, seed))
        if key in existing:
            skipped += 1

    to_do = len(work) - skipped
    with tqdm(total=to_do, desc="Run experiment", unit="call") as pbar:
        for model_cfg, base, par, temp, t in work:
            model_name = model_cfg["name"]
            ollama_id = model_cfg["ollama_identifier"]
            base_id = base["base_id"]
            variant_id = par["variant_id"]
            prompt_text = par["text"]
            seed = deterministic_seed(model_name, base_id, variant_id, temp, t)
            key = str((model_name, base_id, variant_id, temp, seed))
            if key in existing:
                continue
            pbar.set_postfix_str(f"{model_name} {base_id} {variant_id} T={temp} #{t}")
            try:
                response = call_ollama_with_retries(
                    prompt=prompt_text,
                    model_name=ollama_id,
                    temperature=temp,
                    top_p=decoding["top_p"],
                    top_k=decoding["top_k"],
                    repeat_penalty=decoding["repeat_penalty"],
                    seed=seed,
                    max_tokens=decoding["max_tokens"],
                    base_url=base_url,
                    timeout_seconds=timeout,
                    max_retries=max_retries,
                )
                record = {
                    "model": model_name,
                    "model_hash": ollama_id,
                    "base_id": base_id,
                    "variant_id": variant_id,
                    "task": base["task"],
                    "temperature": temp,
                    "sample_index": t,
                    "seed": seed,
                    "prompt": prompt_text,
                    "response": response,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "ollama_version": ollama_version,
                    "client_version": client_version,
                    "failure": None,
                    "git_commit": git_hash,
                }
            except OllamaError as e:
                record = {
                    "model": model_name,
                    "model_hash": ollama_id,
                    "base_id": base_id,
                    "variant_id": variant_id,
                    "task": base["task"],
                    "temperature": temp,
                    "sample_index": t,
                    "seed": seed,
                    "prompt": prompt_text,
                    "response": "",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "ollama_version": ollama_version,
                    "client_version": client_version,
                    "failure": str(e),
                    "git_commit": git_hash,
                }
                logger.warning("Ollama failed for %s %s %s: %s", model_name, base_id, variant_id, e)
            _log_record(record, log_path)
            existing.add(key)
            pbar.update(1)

    print(f"Experiment run complete. Log: {log_path}")

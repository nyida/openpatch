#!/usr/bin/env python3
"""
Fetch GSM8K test set and write JSON in repo format for OpenPatch evals and CORTEX.
Output: evals/datasets/gsm8k.json (list of {id, prompt, ground_truth}).
Requires: pip install datasets
Usage: from repo root, python scripts/fetch_gsm8k.py
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "evals" / "datasets" / "gsm8k.json"
# Use cache inside repo to avoid permission issues
os.environ.setdefault("HF_HOME", str(ROOT / ".cache" / "huggingface"))
os.environ.setdefault("HF_DATASETS_CACHE", str(ROOT / ".cache" / "huggingface" / "datasets"))


def extract_answer(answer_str: str) -> str:
    """GSM8K answer has final value after ####. Return that as ground_truth."""
    if not answer_str or not isinstance(answer_str, str):
        return ""
    # Official format: " ... #### 42" or "#### 42"
    match = re.search(r"####\s*(.+)", answer_str.strip())
    if match:
        return match.group(1).strip()
    return answer_str.strip()


def main() -> int:
    try:
        from datasets import load_dataset
    except ImportError:
        print("Install: pip install datasets", file=sys.stderr)
        return 1

    print("Loading openai/gsm8k main test split...")
    ds = load_dataset("openai/gsm8k", "main", split="test")
    out = []
    for i, row in enumerate(ds):
        question = (row.get("question") or "").strip()
        answer_raw = row.get("answer") or ""
        gt = extract_answer(answer_raw)
        out.append({
            "id": f"gsm8k_{i}",
            "prompt": question,
            "ground_truth": gt,
        })
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(out)} items to {OUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

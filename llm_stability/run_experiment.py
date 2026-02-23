"""
Entry point: run full experiment (Ollama calls, log to JSONL).
Usage: python run_experiment.py --config configs/main.yaml
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Ensure project root (llm_stability) is on path when run as script
_root = Path(__file__).resolve().parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from src.runner import run_experiment


def main() -> None:
    parser = argparse.ArgumentParser(description="Run LLM stability experiment")
    parser.add_argument("--config", required=True, help="Path to config YAML (e.g. configs/main.yaml)")
    args = parser.parse_args()
    run_experiment(args.config)


if __name__ == "__main__":
    main()

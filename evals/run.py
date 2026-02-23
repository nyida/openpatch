"""
Run evaluation: for each dataset item, POST to Next.js API (baseline + improved).
Logs go to app_runs/logs/runs.jsonl (server-side). Dry run flows through same API with EVAL_DRY_RUN fake LLM.
Usage: python -m evals.run --config evals/configs/main.yaml
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def load_yaml(path: Path) -> dict:
    try:
        import yaml
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except Exception:
        return {}


def main() -> None:
    parser = argparse.ArgumentParser(description="Run eval: baseline + improved per dataset item via API")
    parser.add_argument("--config", required=True, help="Path to config YAML (e.g. evals/configs/main.yaml)")
    args = parser.parse_args()

    config_path = Path(args.config)
    if not config_path.is_absolute():
        config_path = (Path.cwd() / config_path).resolve()
        if not config_path.exists():
            config_path = ROOT / args.config
    config = load_yaml(config_path)
    datasets_cfg = config.get("datasets", [])
    api_base = (config.get("api_base") or "http://localhost:3000").rstrip("/")
    dry_run = config.get("dry_run", False) or (os.environ.get("EVAL_DRY_RUN") == "1")

    try:
        import requests
    except ImportError:
        print("Install requests: pip install requests")
        sys.exit(1)

    for ds in datasets_cfg:
        ds_id = ds.get("id", "default")
        path_val = ds.get("path", "")
        ds_path = ROOT / path_val if path_val else ROOT / "evals" / "datasets" / f"{ds_id}.json"
        if not ds_path.exists():
            print(f"Dataset not found: {ds_path}")
            continue
        with open(ds_path, "r", encoding="utf-8") as f:
            items = json.load(f)
        if not isinstance(items, list):
            items = [items]
        for item in items:
            pid = item.get("id", "?")
            prompt = item.get("prompt", "")
            ground_truth = item.get("ground_truth", "")
            for mode in ("baseline", "improved"):
                url = f"{api_base}/api/eval/run-one"
                payload = {
                    "dataset_id": ds_id,
                    "item_id": pid,
                    "prompt": prompt,
                    "ground_truth": ground_truth,
                    "mode": mode,
                    "dry_run": dry_run,
                }
                try:
                    r = requests.post(url, json=payload, timeout=120)
                    r.raise_for_status()
                    data = r.json()
                    print(f"  {ds_id} {pid} {mode} -> run_id={data.get('run_id', '?')}")
                except Exception as e:
                    print(f"  {ds_id} {pid} {mode} FAILED: {e}")
    print("Run phase done.")


if __name__ == "__main__":
    main()

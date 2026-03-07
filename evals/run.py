"""
Run evaluation: for each dataset item, POST to Next.js API (baseline, improved, standard).
Supports --limit and --seed for bounded runs (e.g. 500 items). Logs go to app_runs/logs/runs.jsonl (server-side).
Writes one run_metadata.json per run with full provenance (per-dataset counts and aggregates).
Usage: python -m evals.run --config evals/configs/main.yaml [--limit 500] [--seed 42]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
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


def _file_sha256(path: Path) -> str | None:
    try:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()
    except Exception:
        return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Run eval: baseline / improved / standard per dataset item via API")
    parser.add_argument("--config", required=True, help="Path to config YAML (e.g. evals/configs/main.yaml)")
    parser.add_argument("--limit", type=int, default=None, help="Max items per dataset (default: from config or all)")
    parser.add_argument("--seed", type=int, default=None, help="Random seed for shuffling before limit (default: from config or 42)")
    args = parser.parse_args()

    started_at = datetime.now(timezone.utc).isoformat()

    config_path = Path(args.config)
    if not config_path.is_absolute():
        config_path = (Path.cwd() / config_path).resolve()
        if not config_path.exists():
            config_path = ROOT / args.config
    config = load_yaml(config_path)
    datasets_cfg = config.get("datasets", [])
    api_base = (config.get("api_base") or "http://localhost:3000").rstrip("/")
    dry_run = config.get("dry_run", False) or (os.environ.get("EVAL_DRY_RUN") == "1")
    limit = args.limit if args.limit is not None else config.get("limit")
    seed = args.seed if args.seed is not None else config.get("seed", 42)
    modes_cfg = config.get("modes", ["baseline", "improved"])
    if isinstance(modes_cfg, str):
        modes_cfg = [modes_cfg]
    num_candidates = config.get("num_candidates")
    results_dir = Path(config.get("results_dir", "evals/results"))
    if not results_dir.is_absolute():
        results_dir = ROOT / results_dir
    results_dir.mkdir(parents=True, exist_ok=True)

    try:
        import requests
    except ImportError:
        print("Install requests: pip install requests")
        sys.exit(1)

    dataset_reports = []
    n_total_all = 0
    n_used_all = 0
    skipped_all = 0

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
        n_total = len(items)
        if limit is not None and n_total > 0:
            rng = __import__("random").Random(seed)
            indices = list(range(n_total))
            rng.shuffle(indices)
            items = [items[i] for i in indices[:limit]]
        n_used = len(items)
        skipped = n_total - n_used

        report = {
            "name": ds_id,
            "path": str(ds_path),
            "n_total": n_total,
            "n_used": n_used,
            "skipped": skipped,
        }
        ds_hash = _file_sha256(ds_path)
        if ds_hash is not None:
            report["sha256"] = ds_hash
        dataset_reports.append(report)

        n_total_all += n_total
        n_used_all += n_used
        skipped_all += skipped

        print(f"Dataset {ds_id}: n_total={n_total}, n_used={n_used}, skipped={skipped} (limit={limit}, seed={seed})")

        for item in items:
            pid = item.get("id", "?")
            prompt = item.get("prompt", "")
            ground_truth = item.get("ground_truth", "")
            for mode in modes_cfg:
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
                    r = requests.post(url, json=payload, timeout=180)
                    r.raise_for_status()
                    data = r.json()
                    print(f"  {ds_id} {pid} {mode} -> run_id={data.get('run_id', '?')}")
                except Exception as e:
                    print(f"  {ds_id} {pid} {mode} FAILED: {e}")

    finished_at = datetime.now(timezone.utc).isoformat()

    submission_n = config.get("submission_n", 500)
    has_gsm8k = any((d.get("name") == "gsm8k" for d in dataset_reports))
    modes_ok = set(modes_cfg) >= {"baseline", "improved", "standard"}
    is_submission_run = (
        not dry_run
        and has_gsm8k
        and n_used_all == submission_n
        and modes_ok
        and num_candidates == 3
    )

    run_metadata = {
        "started_at": started_at,
        "finished_at": finished_at,
        "seed": seed,
        "limit": limit,
        "modes": modes_cfg,
        "num_candidates": num_candidates,
        "datasets": dataset_reports,
        "n_total_all": n_total_all,
        "n_used_all": n_used_all,
        "skipped_all": skipped_all,
        "dry_run": dry_run,
        "is_submission_run": is_submission_run,
    }
    config_hash = _file_sha256(config_path)
    if config_hash is not None:
        run_metadata["config_sha256"] = config_hash
    run_metadata["config_path"] = str(config_path)

    with open(results_dir / "run_metadata.json", "w", encoding="utf-8") as f:
        json.dump(run_metadata, f, indent=2)
    print("Run phase done. Metadata written to", results_dir / "run_metadata.json")
    if not is_submission_run:
        print("NOTE: is_submission_run=false. Export-for-paper will emit \\errmessage; paper will not compile until you run a submission run (see evals/README.md).")


if __name__ == "__main__":
    main()

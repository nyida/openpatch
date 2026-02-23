"""
Shared utilities: config loading, paths, git hash, deterministic helpers.
No global state. All functions pure or explicitly take config/paths.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any

import yaml


def load_yaml(path: str | Path) -> dict[str, Any]:
    """Load and return YAML config as dict. Raises on missing file or invalid YAML."""
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    with open(p, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError(f"Config must be a YAML object (dict), got {type(data)}")
    return data


def get_git_commit_hash(repo_path: str | Path | None = None) -> str | None:
    """Return current git commit hash or None if not a repo or git unavailable."""
    try:
        cmd = ["git", "rev-parse", "HEAD"]
        cwd = Path(repo_path) if repo_path else Path.cwd()
        out = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        if out.returncode == 0 and out.stdout:
            return out.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    return None


def ensure_dir(path: str | Path) -> Path:
    """Create directory (and parents) if not exists. Return Path."""
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


def write_json_snapshot(data: dict[str, Any], filepath: str | Path) -> None:
    """Write JSON to file with consistent formatting for reproducibility."""
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, sort_keys=True)


def deterministic_seed(
    model: str,
    base_id: str,
    variant_id: str,
    temperature: float,
    sample_index: int,
) -> int:
    """
    Produce a deterministic seed for a single (model, base, variant, temp, sample) run.
    Uses SHA256 only (never Python's hash()). Formula:
      s = f"{model}{base_id}{variant_id}_{temperature}_{sample_index}"
      seed = int(sha256(s).hexdigest()[:8], 16) % 2**31
    """
    s = f"{model}{base_id}{variant_id}_{temperature}_{sample_index}"
    h = hashlib.sha256(s.encode("utf-8")).hexdigest()
    return int(h[:8], 16) % (2**31)

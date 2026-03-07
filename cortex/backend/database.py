"""
CORTEX database layer: queries, responses, routing.
Uses SQLite for experiment/analytics; can be swapped for PostgreSQL.
"""
from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Generator

DB_PATH = os.environ.get("CORTEX_DB_PATH", "cortex/data/cortex.db")


def _ensure_dir(path: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)


@contextmanager
def get_connection() -> Generator[sqlite3.Connection, None, None]:
    _ensure_dir(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS queries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prompt TEXT NOT NULL,
            timestamp TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            query_id INTEGER NOT NULL,
            model TEXT NOT NULL,
            output TEXT NOT NULL,
            confidence REAL,
            correct INTEGER,
            latency REAL,
            token_count INTEGER,
            FOREIGN KEY (query_id) REFERENCES queries(id)
        );
        CREATE TABLE IF NOT EXISTS routing (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            query_id INTEGER NOT NULL,
            selected_model TEXT NOT NULL,
            expected_confidence REAL,
            FOREIGN KEY (query_id) REFERENCES queries(id)
        );
        CREATE INDEX IF NOT EXISTS idx_responses_query ON responses(query_id);
        CREATE INDEX IF NOT EXISTS idx_routing_query ON routing(query_id);
        -- Experiment records: per-(prompt, model) for calibration/router training (backward compatible).
        CREATE TABLE IF NOT EXISTS experiment_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prompt_id INTEGER NOT NULL,
            model_name TEXT NOT NULL,
            output_text TEXT NOT NULL,
            latency_ms REAL,
            token_count INTEGER,
            raw_confidence REAL NOT NULL,
            feature_json TEXT,
            correct INTEGER NOT NULL,
            dataset_name TEXT NOT NULL,
            split TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (prompt_id) REFERENCES queries(id)
        );
        CREATE INDEX IF NOT EXISTS idx_exp_records_split ON experiment_records(split);
        CREATE INDEX IF NOT EXISTS idx_exp_records_dataset ON experiment_records(dataset_name);
    """)


def insert_query(conn: sqlite3.Connection, prompt: str) -> int:
    cur = conn.execute("INSERT INTO queries (prompt) VALUES (?)", (prompt,))
    return cur.lastrowid or 0


def insert_response(
    conn: sqlite3.Connection,
    query_id: int,
    model: str,
    output: str,
    *,
    confidence: float | None = None,
    correct: bool | None = None,
    latency: float | None = None,
    token_count: int | None = None,
) -> int:
    cur = conn.execute(
        "INSERT INTO responses (query_id, model, output, confidence, correct, latency, token_count) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (query_id, model, output, confidence, 1 if correct else (0 if correct is False else None), latency, token_count),
    )
    return cur.lastrowid or 0


def insert_routing(
    conn: sqlite3.Connection,
    query_id: int,
    selected_model: str,
    expected_confidence: float,
) -> int:
    cur = conn.execute(
        "INSERT INTO routing (query_id, selected_model, expected_confidence) VALUES (?, ?, ?)",
        (query_id, selected_model, expected_confidence),
    )
    return cur.lastrowid or 0


def get_query_responses(conn: sqlite3.Connection, query_id: int) -> list[dict[str, Any]]:
    cur = conn.execute(
        "SELECT id, query_id, model, output, confidence, correct, latency, token_count FROM responses WHERE query_id = ?",
        (query_id,),
    )
    return [dict(row) for row in cur.fetchall()]


def insert_experiment_record(
    conn: sqlite3.Connection,
    prompt_id: int,
    model_name: str,
    output_text: str,
    raw_confidence: float,
    feature_json: str,
    correct: int,
    dataset_name: str,
    split: str,
    *,
    latency_ms: float | None = None,
    token_count: int | None = None,
) -> int:
    """Insert one per-(prompt, model) record for calibration/router training."""
    cur = conn.execute(
        """INSERT INTO experiment_records (
            prompt_id, model_name, output_text, latency_ms, token_count,
            raw_confidence, feature_json, correct, dataset_name, split
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            prompt_id,
            model_name,
            output_text,
            latency_ms,
            token_count,
            raw_confidence,
            feature_json,
            correct,
            dataset_name,
            split,
        ),
    )
    return cur.lastrowid or 0


def load_experiment_records(
    conn: sqlite3.Connection,
    *,
    split: str | None = None,
    dataset_name: str | None = None,
) -> list[dict[str, Any]]:
    """Load experiment records, optionally filtered by split and/or dataset_name."""
    conditions: list[str] = []
    params: list[Any] = []
    if split is not None:
        conditions.append("split = ?")
        params.append(split)
    if dataset_name is not None:
        conditions.append("dataset_name = ?")
        params.append(dataset_name)
    q = "SELECT * FROM experiment_records"
    if conditions:
        q += " WHERE " + " AND ".join(conditions)
    cur = conn.execute(q, params) if params else conn.execute(q)
    return [dict(row) for row in cur.fetchall()]

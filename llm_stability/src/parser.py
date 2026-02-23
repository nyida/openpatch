"""
Parser for model output format: ANSWER: <value>
Extracts label or numeric; marks invalid outputs. No silent coercion.
"""

from __future__ import annotations

import re
from typing import Any


def parse_response(raw: str) -> dict[str, Any]:
    """
    Parse model output expecting "ANSWER: <value>".
    Returns {"valid": bool, "value": ... (str or number or None), "error": str or None}.
    Never silently coerces malformed responses; invalid => valid=False, error set.
    """
    if not isinstance(raw, str):
        return {"valid": False, "value": None, "error": "response must be a string"}
    text = raw.strip()
    if not text:
        return {"valid": False, "value": None, "error": "empty response"}

    # Match "ANSWER: X" (case-insensitive, optional whitespace)
    m = re.search(r"ANSWER\s*:\s*(.+)", text, re.IGNORECASE | re.DOTALL)
    if not m:
        return {"valid": False, "value": None, "error": "ANSWER: <value> pattern not found"}

    value_str = m.group(1).strip()
    if not value_str:
        return {"valid": False, "value": None, "error": "ANSWER value is empty"}

    # Single letter A/B/C/D (with optional period/parens)
    letter = re.match(r"^\s*([A-Da-d])\s*[.).]?\s*$", value_str)
    if letter:
        return {"valid": True, "value": letter.group(1).upper(), "error": None}

    # Numeric
    num = re.match(r"^\s*(-?\d+(?:\.\d+)?)\s*$", value_str)
    if num:
        try:
            v = float(num.group(1))
            if v == int(v):
                return {"valid": True, "value": int(v), "error": None}
            return {"valid": True, "value": v, "error": None}
        except ValueError:
            pass

    # Accept raw single letter as value
    if len(value_str) == 1 and value_str.upper() in ("A", "B", "C", "D"):
        return {"valid": True, "value": value_str.upper(), "error": None}

    return {"valid": False, "value": None, "error": f"unparseable value: {value_str[:100]!r}"}

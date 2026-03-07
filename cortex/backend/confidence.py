"""
CORTEX Component 3: Confidence Estimation Layer.
Predicts probability that an answer is correct from features:
response length, token entropy, self-consistency (agreement across models), generation log-probability proxy.
Ref: Jiang et al., 2021 — How Can We Know What Language Models Know (arXiv:1911.12543)
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from .inference import ModelResponse


@dataclass
class ConfidenceFeatures:
    response_length: int
    token_entropy: float
    self_consistency: float  # 0–1 agreement across models
    agreement_count: int
    num_models: int
    mean_length: float
    length_std: float


def _simple_entropy(text: str) -> float:
    """Token-level entropy proxy: word unigram entropy."""
    if not text.strip():
        return 0.0
    tokens = text.lower().split()
    if not tokens:
        return 0.0
    from collections import Counter
    c = Counter(tokens)
    n = len(tokens)
    return -sum((v / n) * math.log2(v / n) for v in c.values())


def _normalize_length(length: int, mean_l: float, std_l: float) -> float:
    if std_l <= 0:
        return 0.5
    z = (length - mean_l) / std_l
    return 1.0 / (1.0 + math.exp(-z))


def extract_confidence_features(responses: list[ModelResponse]) -> ConfidenceFeatures:
    """Extract features from multiple model responses for one prompt."""
    if not responses:
        return ConfidenceFeatures(
            response_length=0,
            token_entropy=0.0,
            self_consistency=0.0,
            agreement_count=0,
            num_models=0,
            mean_length=0.0,
            length_std=0.0,
        )
    outputs = [r.output.strip() for r in responses if r.output and not r.output.startswith("[Error")]
    lengths = [len(o.split()) for o in outputs]
    mean_length = sum(lengths) / len(lengths) if lengths else 0.0
    length_std = (sum((x - mean_length) ** 2 for x in lengths) / len(lengths)) ** 0.5 if len(lengths) > 1 else 0.0
    entropies = [_simple_entropy(o) for o in outputs]
    token_entropy = sum(entropies) / len(entropies) if entropies else 0.0
    # Self-consistency: fraction of models that agree with the most common answer (normalized by length)
    def norm_answer(s: str) -> str:
        return " ".join(s.lower().split())[:200]
    normalized = [norm_answer(o) for o in outputs]
    if not normalized:
        agreement = 0.0
        agreement_count = 0
    else:
        from collections import Counter
        most_common, count = Counter(normalized).most_common(1)[0]
        agreement_count = count
        agreement = count / len(normalized)
    primary_length = lengths[0] if lengths else 0
    return ConfidenceFeatures(
        response_length=primary_length,
        token_entropy=token_entropy,
        self_consistency=agreement,
        agreement_count=agreement_count,
        num_models=len(responses),
        mean_length=mean_length,
        length_std=length_std,
    )


def confidence_score_from_features(features: ConfidenceFeatures) -> float:
    """
    Map features to a 0–1 confidence score.
    Higher self-consistency and moderate entropy tend to indicate higher confidence.
    """
    if features.num_models == 0:
        return 0.0
    # Weight self-consistency heavily (agreement across models)
    base = features.self_consistency * 0.7
    # Moderate entropy: very low can mean repetition; very high can mean noisy
    entropy_norm = min(1.0, features.token_entropy / 8.0) if features.token_entropy else 0.0
    base += 0.2 * entropy_norm
    # Length stability (similar lengths across models)
    if features.length_std > 0 and features.mean_length > 0:
        cv = features.length_std / features.mean_length
        length_stability = max(0, 1.0 - cv)
        base += 0.1 * length_stability
    return min(1.0, max(0.0, base))


def estimate_confidence(responses: list[ModelResponse]) -> tuple[float, ConfidenceFeatures]:
    """Returns (confidence_score in [0,1], features)."""
    features = extract_confidence_features(responses)
    score = confidence_score_from_features(features)
    return round(score, 4), features


def features_to_dict(features: ConfidenceFeatures) -> dict[str, Any]:
    """Serialize ConfidenceFeatures to a JSON-serializable dict for storage."""
    return {
        "response_length": features.response_length,
        "token_entropy": features.token_entropy,
        "self_consistency": features.self_consistency,
        "agreement_count": features.agreement_count,
        "num_models": features.num_models,
        "mean_length": features.mean_length,
        "length_std": features.length_std,
    }


# Refusal/hedging patterns: correlate with lower correctness (lightweight, reproducible)
REFUSAL_HEDGING_PATTERNS = [
    r"\bi('m|am) not sure\b",
    r"\bi don('t| do not) know\b",
    r"\bcannot\b",
    r"\bcan't (answer|determine|say)\b",
    r"\bi (cannot|can't)\b",
    r"\bunable to\b",
    r"\b(i )?don't have (enough )?information\b",
    r"\b(i )?do not have (enough )?information\b",
    r"\bit (is )?not (possible|clear)\b",
    r"\b(i )?cannot (answer|determine|say)\b",
]


def detect_refusal_hedging(text: str) -> bool:
    """True if text matches common refusal/hedging patterns (reproducible, no external deps)."""
    if not (text and text.strip()):
        return False
    import re
    lower = text.lower().strip()
    for pat in REFUSAL_HEDGING_PATTERNS:
        if re.search(pat, lower, re.IGNORECASE):
            return True
    return False


def extract_per_response_features(
    response: ModelResponse,
    all_responses: list[ModelResponse],
) -> dict[str, Any]:
    """
    Per-(response) features for router: response_length, response_entropy, refusal_detected.
    Used together with ensemble features for P(correct|features).
    """
    out: dict[str, Any] = {}
    out["response_length"] = len(response.output.split()) if response.output else 0
    out["response_entropy"] = _simple_entropy(response.output) if response.output else 0.0
    out["refusal_detected"] = 1.0 if detect_refusal_hedging(response.output or "") else 0.0
    return out


def build_per_response_feature_json(
    ensemble_dict: dict[str, Any],
    per_response: dict[str, Any],
) -> dict[str, Any]:
    """Merge ensemble and per-response features for one (prompt, model) record."""
    return {**ensemble_dict, **per_response}

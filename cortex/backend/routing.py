"""
CORTEX Component 5: Routing Optimization Layer.
Select best model dynamically: if learned router artifact exists, use it (argmax P(correct));
otherwise fall back to select_best_model_by_confidence.
"""
from __future__ import annotations

import pickle
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

from .confidence import (
    ConfidenceFeatures,
    estimate_confidence,
    extract_confidence_features,
    extract_per_response_features,
    features_to_dict,
)
from .inference import ModelResponse

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
ROUTER_ARTIFACT = MODELS_DIR / "router.pkl"
ROUTER_METADATA = MODELS_DIR / "router_metadata.json"

# Canonical feature order: training and inference must use identical ordering.
FEATURE_ORDER = [
    "raw_confidence",
    "token_entropy",
    "self_consistency",
    "response_length",
    "response_entropy",
    "mean_length",
    "length_std",
    "agreement_count",
    "num_models",
    "refusal_detected",
]

_ROUTER_CACHE: dict[str, Any] | None = None
_ROUTER_CACHE_MTIME: float | None = None


def build_feature_vector(
    raw_confidence: float,
    model_name: str,
    feature_dict: dict[str, Any],
    latency_ms: float,
    token_count: float | int | None,
    model_to_idx: dict[str, int],
    models: list[str],
) -> np.ndarray:
    """
    Single canonical feature builder for router. Used by both training (from feature_json)
    and inference (from ensemble + per-response features). Keeps training/inference isomorphic.
    """
    feats = [float(raw_confidence)]
    feats.extend([
        float(feature_dict.get("token_entropy", 0.0)),
        float(feature_dict.get("self_consistency", 0.0)),
        float(feature_dict.get("response_length", 0.0)),
        float(feature_dict.get("response_entropy", 0.0)),
        float(feature_dict.get("mean_length", 0.0)),
        float(feature_dict.get("length_std", 0.0)),
        float(feature_dict.get("agreement_count", 0)),
        float(feature_dict.get("num_models", 0)),
        float(feature_dict.get("refusal_detected", 0.0)),
    ])
    n_models = len(models)
    model_idx = model_to_idx.get(model_name, 0)
    one_hot = [0.0] * n_models
    if n_models:
        one_hot[min(model_idx, n_models - 1)] = 1.0
    feats.extend(one_hot)
    feats.append(float(latency_ms or 0.0))
    feats.append(float(token_count or 0.0))
    return np.array(feats, dtype=np.float64)


def _feature_vector(features: ConfidenceFeatures, model_name: str, model_index: int, num_models: int) -> np.ndarray:
    """Legacy: build vector for RoutingOptimizer (in-memory fit). Prefer build_feature_vector for train/inference."""
    return np.array([
        features.response_length,
        features.token_entropy,
        features.self_consistency,
        features.agreement_count,
        features.num_models,
        features.mean_length,
        features.length_std,
        float(hash(model_name) % 1000) / 1000.0,
        model_index / max(1, num_models),
    ], dtype=np.float64)


class RoutingOptimizer:
    """
    Lightweight classifier: given (confidence features, model) -> P(correct).
    Fit on (feature_vec, correct) from experiment data; at inference select model with highest predicted P(correct).
    """

    def __init__(self, *, C: float = 1.0, max_iter: int = 500):
        self.scaler = StandardScaler()
        self.clf = LogisticRegression(C=C, max_iter=max_iter, random_state=42)
        self._fitted = False

    def fit(self, X: np.ndarray, y: np.ndarray) -> "RoutingOptimizer":
        X = np.asarray(X)
        y = np.asarray(y).ravel()
        if X.size == 0 or len(y) == 0:
            return self
        X_scaled = self.scaler.fit_transform(X)
        self.clf.fit(X_scaled, y)
        self._fitted = True
        return self

    def predict_proba_correct(self, X: np.ndarray) -> np.ndarray:
        if not self._fitted or X.size == 0:
            return np.zeros(len(X))
        X_scaled = self.scaler.transform(np.asarray(X))
        return self.clf.predict_proba(X_scaled)[:, 1]  # P(correct)

    def select_model(
        self,
        responses: list[ModelResponse],
        confidence_scores: list[float] | None = None,
        features_per_model: list[ConfidenceFeatures] | None = None,
    ) -> tuple[str, float]:
        """
        Select model with highest predicted correctness.
        If no classifier fitted, falls back to highest confidence score.
        """
        if not responses:
            return "", 0.0
        if confidence_scores is None:
            _, feats = estimate_confidence(responses)
            confidence_scores = [estimate_confidence([r])[0] for r in responses]
            features_per_model = [feats] * len(responses)
        if features_per_model is None:
            single = extract_confidence_features(responses)
            features_per_model = [single] * len(responses)
        if not features_per_model or len(features_per_model) < len(responses):
            single = extract_confidence_features(responses)
            features_per_model = [single] * len(responses)

        if self._fitted:
            X = np.array([
                _feature_vector(features_per_model[i], r.model, i, len(responses))
                for i, r in enumerate(responses)
            ])
            probs = self.predict_proba_correct(X)
            best_idx = int(np.argmax(probs))
            return responses[best_idx].model, float(probs[best_idx])
        # Fallback: highest confidence
        best_idx = max(range(len(responses)), key=lambda i: confidence_scores[i] if i < len(confidence_scores) else 0)
        return responses[best_idx].model, confidence_scores[best_idx] if best_idx < len(confidence_scores) else 0.0


def select_best_model_by_confidence(responses: list[ModelResponse]) -> tuple[ModelResponse, float]:
    """No classifier: select model whose response has highest confidence (from multi-response consistency)."""
    if not responses:
        raise ValueError("No responses")
    score, _ = estimate_confidence(responses)
    # Prefer first model when tied; could use latency as tie-break
    best = max(responses, key=lambda r: (len(r.output), -r.latency_ms))
    return best, score


def _load_router_artifact() -> dict[str, Any] | None:
    """Load router.pkl and return dict with scaler, clf, model_to_idx, models; None if missing."""
    global _ROUTER_CACHE, _ROUTER_CACHE_MTIME
    if not ROUTER_ARTIFACT.exists():
        _ROUTER_CACHE = None
        _ROUTER_CACHE_MTIME = None
        return None
    try:
        mtime = ROUTER_ARTIFACT.stat().st_mtime
        if _ROUTER_CACHE is not None and _ROUTER_CACHE_MTIME == mtime:
            return _ROUTER_CACHE
        with open(ROUTER_ARTIFACT, "rb") as f:
            _ROUTER_CACHE = pickle.load(f)
        _ROUTER_CACHE_MTIME = mtime
        return _ROUTER_CACHE
    except Exception:
        return None


def select_model_with_router(
    responses: list[ModelResponse],
    raw_confidence: float,
    features: ConfidenceFeatures,
    per_response_features: list[dict[str, Any]] | None = None,
) -> tuple[ModelResponse | None, float, list[float]]:
    """
    If router artifact exists: compute P(correct) per response via shared build_feature_vector, select argmax.
    Returns (best_response, selected_prob, all_probs). per_response_features[i] = {response_length, response_entropy, refusal_detected}.
    """
    artifact = _load_router_artifact()
    if not artifact or not responses:
        return None, 0.0, []
    scaler = artifact.get("scaler")
    clf = artifact.get("clf")
    model_to_idx = artifact.get("model_to_idx", {})
    models = artifact.get("models", [])
    if scaler is None or clf is None:
        return None, 0.0, []
    if per_response_features is None or len(per_response_features) != len(responses):
        per_response_features = [extract_per_response_features(r, responses) for r in responses]
    ensemble_dict = features_to_dict(features)
    X_list = []
    for i, r in enumerate(responses):
        merged = {**ensemble_dict, **per_response_features[i]}
        vec = build_feature_vector(
            raw_confidence,
            r.model,
            merged,
            r.latency_ms,
            r.token_count,
            model_to_idx,
            models,
        )
        X_list.append(vec)
    X = np.vstack(X_list)
    X_scaled = scaler.transform(X)
    probs = clf.predict_proba(X_scaled)[:, 1]
    best_idx = int(np.argmax(probs))
    return responses[best_idx], float(probs[best_idx]), probs.tolist()

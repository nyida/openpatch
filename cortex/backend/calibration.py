"""
CORTEX Component 4: Calibration Layer.
We calibrate a heuristic confidence score via logit-space temperature scaling.
We do not calibrate model likelihoods (token logprobs); the input is a scalar heuristic
(e.g. from self-consistency / agreement), and we fit temperature so that the scaled
score better matches empirical accuracy (ECE, NLL). Ref: Guo et al., 2017 — On Calibration
of Modern Neural Networks (arXiv:1706.04599).
"""
from __future__ import annotations

import math
from typing import List, Tuple

import numpy as np


def expected_calibration_error(
    confidences: List[float],
    corrects: List[bool],
    n_bins: int = 10,
) -> float:
    """
    ECE = sum_m (|B_m| / n) * |acc(B_m) - conf(B_m)|.
    """
    if not confidences or len(confidences) != len(corrects):
        return 0.0
    confidences = np.clip(np.asarray(confidences, dtype=float), 0.0, 1.0)
    corrects = np.asarray(corrects, dtype=float)
    n = len(confidences)
    bin_edges = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    for i in range(n_bins):
        low, high = bin_edges[i], bin_edges[i + 1]
        mask = (confidences >= low) & (confidences < high) if i < n_bins - 1 else (confidences >= low) & (confidences <= high)
        size = mask.sum()
        if size == 0:
            continue
        acc = corrects[mask].mean()
        avg_conf = confidences[mask].mean()
        ece += (size / n) * abs(acc - avg_conf)
    return float(ece)


def brier_score(confidences: List[float], corrects: List[bool]) -> float:
    """Brier score: mean (confidence - correct)^2. Lower is better."""
    if not confidences or len(confidences) != len(corrects):
        return 0.0
    confidences = np.asarray(confidences, dtype=float)
    corrects = np.asarray(corrects, dtype=float)
    return float(np.mean((confidences - corrects) ** 2))


def temperature_scale(logits: np.ndarray, temperature: float) -> np.ndarray:
    """Apply temperature scaling to logits: logits / T."""
    return np.asarray(logits, dtype=float) / max(1e-6, temperature)


def apply_temperature_to_confidence(raw_confidence: float, temperature: float) -> float:
    """
    Calibrate a heuristic confidence score via logit-space temperature scaling:
    logit(p) = ln(p/(1-p)), scaled = logit/T, return sigma(scaled). Ref: Guo et al., 2017.
    Valid for probability p in (0,1). Not applied to token logprobs / model likelihoods.
    """
    eps = 1e-6
    p = min(max(float(raw_confidence), eps), 1.0 - eps)
    logit = math.log(p / (1.0 - p))
    T = max(float(temperature), eps)
    scaled = logit / T
    return 1.0 / (1.0 + math.exp(-scaled))


def _nll(confidences: np.ndarray, corrects: np.ndarray, eps: float = 1e-6) -> float:
    """Binary cross-entropy / negative log-likelihood. Lower is better."""
    p = np.clip(confidences.astype(float), eps, 1.0 - eps)
    return float(-np.mean(corrects * np.log(p) + (1.0 - corrects) * np.log(1.0 - p)))


def find_temperature_nll(
    confidences: List[float],
    corrects: List[bool],
    low: float = 0.5,
    high: float = 3.0,
    n_steps: int = 50,
) -> Tuple[float, float]:
    """
    Fit temperature T by minimizing NLL (negative log-likelihood) on calibrated probabilities.
    Uses logit-based apply_temperature_to_confidence. Returns (best_T, best_nll).
    """
    confidences = np.asarray(confidences, dtype=float)
    corrects = np.asarray(corrects, dtype=float)
    if len(confidences) < 2:
        return 1.0, 0.0
    best_t, best_nll = 1.0, 1e9
    for t in np.linspace(low, high, n_steps):
        scaled = np.array([apply_temperature_to_confidence(float(p), float(t)) for p in confidences])
        nll = _nll(scaled, corrects)
        if nll < best_nll:
            best_nll = nll
            best_t = float(t)
    return best_t, best_nll


def find_temperature(
    confidences: List[float],
    corrects: List[bool],
    low: float = 0.5,
    high: float = 3.0,
    n_steps: int = 50,
) -> Tuple[float, float]:
    """
    Fit temperature T by minimizing ECE (secondary to NLL). Uses logit-based scaling.
    Returns (best_T, best_ece).
    """
    confidences = np.asarray(confidences, dtype=float)
    corrects = np.asarray(corrects, dtype=float)
    if len(confidences) < 2:
        return 1.0, 0.0
    best_t, best_ece = 1.0, 1.0
    for t in np.linspace(low, high, n_steps):
        scaled = np.array([apply_temperature_to_confidence(float(p), float(t)) for p in confidences])
        ece = expected_calibration_error(scaled.tolist(), corrects.tolist())
        if ece < best_ece:
            best_ece = ece
            best_t = float(t)
    return best_t, best_ece


def reliability_diagram_bins(
    confidences: List[float],
    corrects: List[bool],
    n_bins: int = 10,
) -> List[Tuple[float, float, int]]:
    """
    Returns list of (bin_center, accuracy, count) for plotting reliability diagram.
    Ref: Niculescu-Mizil and Caruana, 2005.
    """
    if not confidences or len(confidences) != len(corrects):
        return []
    confidences = np.clip(np.asarray(confidences, dtype=float), 0.0, 1.0)
    corrects = np.asarray(corrects, dtype=float)
    bin_edges = np.linspace(0, 1, n_bins + 1)
    out = []
    for i in range(n_bins):
        low, high = bin_edges[i], bin_edges[i + 1]
        mask = (confidences >= low) & (confidences < high) if i < n_bins - 1 else (confidences >= low) & (confidences <= high)
        size = int(mask.sum())
        if size == 0:
            out.append((0.5 * (low + high), 0.0, 0))
            continue
        acc = float(corrects[mask].mean())
        center = float(0.5 * (low + high))
        out.append((center, acc, size))
    return out


def reliability_diagram_bins_detailed(
    confidences: List[float],
    corrects: List[bool],
    n_bins: int = 10,
) -> List[Tuple[float, float, float, int]]:
    """
    Detailed bins for plotting and reporting:
    returns (bin_center, avg_confidence, accuracy, count).
    """
    if not confidences or len(confidences) != len(corrects):
        return []
    confidences_np = np.clip(np.asarray(confidences, dtype=float), 0.0, 1.0)
    corrects_np = np.asarray(corrects, dtype=float)
    bin_edges = np.linspace(0, 1, n_bins + 1)
    out: List[Tuple[float, float, float, int]] = []
    for i in range(n_bins):
        low, high = bin_edges[i], bin_edges[i + 1]
        mask = (
            (confidences_np >= low) & (confidences_np < high)
            if i < n_bins - 1
            else (confidences_np >= low) & (confidences_np <= high)
        )
        size = int(mask.sum())
        center = float(0.5 * (low + high))
        if size == 0:
            out.append((center, center, 0.0, 0))
            continue
        acc = float(corrects_np[mask].mean())
        avg_conf = float(confidences_np[mask].mean())
        out.append((center, avg_conf, acc, size))
    return out

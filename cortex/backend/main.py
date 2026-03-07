"""
CORTEX FastAPI application.
Layer 1 (UI) is the existing Next.js app; this provides /query with calibrated confidence and learned router.
"""
from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import database
from .calibration import apply_temperature_to_confidence
from .confidence import estimate_confidence
from .inference import run_multi_model_inference, ModelResponse
from .routing import select_best_model_by_confidence, select_model_with_router

OLLAMA_BASE = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/").replace("/v1", "")
MODELS = os.environ.get("CORTEX_MODELS", "llama3,mistral,phi,gemma").split(",")
MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
CALIBRATION_ARTIFACT = MODELS_DIR / "calibration.json"


@asynccontextmanager
async def lifespan(app: FastAPI):
    with database.get_connection() as conn:
        database.init_schema(conn)
    yield


app = FastAPI(title="CORTEX", description="Confidence-Optimized Routing and Trust Evaluation", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryInput(BaseModel):
    prompt: str


def _load_calibration_temperature() -> float:
    """Load temperature from calibration.json; return 1.0 if missing."""
    if not CALIBRATION_ARTIFACT.exists():
        return 1.0
    try:
        with open(CALIBRATION_ARTIFACT) as f:
            return float(json.load(f).get("temperature", 1.0))
    except Exception:
        return 1.0


class QueryOutput(BaseModel):
    answer: str
    confidence: float  # when router: selected model's P(correct); else calibrated heuristic
    reliability: str  # High / Medium / Low from thresholds on confidence
    selected_model: str
    alternatives: list[dict]  # each has confidence = per-model P(correct) when router used
    latency_ms: float
    raw_confidence: float | None = None  # debug: heuristic before temp scaling
    ensemble_confidence: float | None = None  # optional: calibrated global (temp-scaled heuristic)
    raw_ensemble_confidence: float | None = None  # optional: heuristic before calibration


@app.post("/query", response_model=QueryOutput)
async def query(inp: QueryInput):
    """Run multi-model inference, calibrate confidence, route (learned or fallback), return answer + confidence + alternatives."""
    models = [m.strip() for m in MODELS if m.strip()]
    responses = await run_multi_model_inference(inp.prompt, models=models, base_url=OLLAMA_BASE)
    if not responses:
        return QueryOutput(
            answer="[No models available]",
            confidence=0.0,
            reliability="Low",
            selected_model="",
            alternatives=[],
            latency_ms=0.0,
            raw_confidence=None,
        )
    raw_confidence, features = estimate_confidence(responses)
    T = _load_calibration_temperature()
    calibrated_ensemble = apply_temperature_to_confidence(raw_confidence, T)
    best_response, selected_confidence, per_model_probs = select_model_with_router(
        responses, raw_confidence, features
    )
    router_used = best_response is not None and len(per_model_probs) == len(responses)
    if best_response is None:
        try:
            best_response, _ = select_best_model_by_confidence(responses)
        except ValueError:
            best_response = responses[0]
        selected_confidence = calibrated_ensemble
        per_model_probs = [calibrated_ensemble] * len(responses)

    if router_used:
        confidence = selected_confidence
        reliability = "High" if confidence >= 0.7 else ("Medium" if confidence >= 0.4 else "Low")
        alternatives = [
            {
                "model": r.model,
                "output": r.output[:500],
                "confidence": round(per_model_probs[i], 4),
                "raw_confidence": round(raw_confidence, 4),
                "latency_ms": r.latency_ms,
            }
            for i, r in enumerate(responses)
            if r.model != best_response.model
        ][:5]
        ensemble_confidence = round(calibrated_ensemble, 4)
        raw_ensemble_confidence = round(raw_confidence, 4)
    else:
        confidence = calibrated_ensemble
        reliability = "High" if confidence >= 0.7 else ("Medium" if confidence >= 0.4 else "Low")
        alternatives = [
            {
                "model": r.model,
                "output": r.output[:500],
                "confidence": round(calibrated_ensemble, 4),
                "raw_confidence": round(raw_confidence, 4),
                "latency_ms": r.latency_ms,
            }
            for r in responses
            if r.model != best_response.model
        ][:5]
        ensemble_confidence = None
        raw_ensemble_confidence = None

    with database.get_connection() as conn:
        qid = database.insert_query(conn, inp.prompt)
        for r in responses:
            database.insert_response(
                conn,
                qid,
                r.model,
                r.output,
                confidence=confidence,
                latency=r.latency_ms,
                token_count=r.token_count,
            )
        database.insert_routing(conn, qid, best_response.model, confidence)
    return QueryOutput(
        answer=best_response.output,
        confidence=round(confidence, 4),
        reliability=reliability,
        selected_model=best_response.model,
        alternatives=alternatives,
        latency_ms=best_response.latency_ms,
        raw_confidence=round(raw_confidence, 4),
        ensemble_confidence=ensemble_confidence,
        raw_ensemble_confidence=raw_ensemble_confidence,
    )


@app.get("/health")
async def health():
    return {"status": "ok"}

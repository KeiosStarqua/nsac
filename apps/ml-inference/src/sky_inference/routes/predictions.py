"""`POST /v1/predict` và `POST /v1/predict/batch` — dự báo có kiểm soát (abstain được phép)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from .. import predictor
from ..feature_builder import unknown_keys
from ..registry import Registry
from ..schemas import BatchRequest, BatchResponse, PredictionResult, PredictRequest
from .models import resolve_task

router = APIRouter(tags=["predictions"])


def _predict(registry: Registry, body: PredictRequest) -> PredictionResult:
    entry = resolve_task(registry, body.task)
    extra = unknown_keys(entry.features, body.features)
    if extra:
        # Schema mismatch (khoá lạ) ⇒ 422, KHÔNG lặng lẽ bỏ qua rồi abstain.
        raise HTTPException(
            status_code=422,
            detail={
                "code": "unknown_feature",
                "task": entry.task,
                "unknown": extra,
                "expected": list(entry.features),
            },
        )
    return predictor.predict_one(entry, body.features, body.history, body.subject_id)


@router.post("/v1/predict", response_model=PredictionResult)
def predict(body: PredictRequest, request: Request) -> PredictionResult:
    return _predict(request.app.state.registry, body)


@router.post("/v1/predict/batch", response_model=BatchResponse)
def predict_batch(body: BatchRequest, request: Request) -> BatchResponse:
    """Giữ nguyên thứ tự đầu vào; tối đa 64 mục (pydantic `max_length` → 422 khi vượt)."""
    registry: Registry = request.app.state.registry
    return BatchResponse(results=[_predict(registry, item) for item in body.items])

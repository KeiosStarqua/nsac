"""Suy luận một yêu cầu → `PredictionResult`, mirror `sky_ml/5_predict.py::predict_rows`.

Thứ tự reason giữ đúng như bản gốc:
1. `missing_features`            — thiếu/NaN đặc trưng bắt buộc;
2. `out_of_training_range`       — giá trị ngoài min/max của bảng train (KHÔNG ngoại suy);
3. `insufficient_calibration_data` — hồi quy mà nửa độ rộng 90% không hữu hạn.
Riêng mô hình cần `history`: thiếu `history` ⇒ short-circuit `history_required`
(nhánh này không có trong `predict_rows` vì CLI luôn có bảng đặc trưng đầy đủ).
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

from .feature_builder import resolve_features
from .registry import TaskModel
from .schemas import Interval90, PredictionResult

HISTORY_REQUIRED = "history_required"
MISSING_FEATURES = "missing_features"
OUT_OF_RANGE = "out_of_training_range"
INSUFFICIENT_CALIBRATION = "insufficient_calibration_data"
NON_FINITE = "non_finite_prediction"  # lưới an toàn: không bao giờ phát NaN ra JSON


def _feature_frame(entry: TaskModel, features: dict[str, float]) -> pd.DataFrame:
    """Hàng đặc trưng đúng thứ tự cột lúc train. Mô hình hằng số không đọc giá trị → điền 0."""
    zero_fill = entry.ignores_features
    row = {
        name: (features[name] if name in features else (0.0 if zero_fill else np.nan))
        for name in entry.features
    }
    return pd.DataFrame([row], columns=list(entry.features), dtype=float)


def _abstain(entry: TaskModel, subject_id: str | None, reasons: list[str]) -> PredictionResult:
    return PredictionResult(
        task=entry.task,
        subjectId=subject_id,
        model=entry.deploy_model,
        modelVersion=entry.run_id,
        prediction=None,
        unit=entry.unit,
        interval90=None,
        abstain=True,
        reasons=reasons,
        provenance=entry.provenance,
    )


def predict_one(
    entry: TaskModel,
    features: dict[str, float],
    history: list[float] | None,
    subject_id: str | None = None,
) -> PredictionResult:
    if not entry.ready:
        raise ValueError(f"task {entry.task} unavailable: {entry.reason}")
    if entry.history_required and not history:
        return _abstain(entry, subject_id, [HISTORY_REQUIRED])

    resolved, missing = resolve_features(entry.features, features, history)

    reasons: list[str] = []
    if missing and not entry.ignores_features:
        reasons.append(MISSING_FEATURES)
    lo, hi = entry.train_min or {}, entry.train_max or {}
    out_of_range = any(
        name in lo and name in hi and (value < lo[name] or value > hi[name])
        for name, value in resolved.items()
    )
    if out_of_range:
        reasons.append(OUT_OF_RANGE)
    if not entry.is_classification and not (entry.half_width is not None and math.isfinite(entry.half_width)):
        reasons.append(INSUFFICIENT_CALIBRATION)
    if reasons:
        return _abstain(entry, subject_id, reasons)

    frame = _feature_frame(entry, resolved)
    if entry.is_classification:
        return _predict_class(entry, frame, subject_id)
    return _predict_regression(entry, frame, subject_id)


def _predict_regression(entry: TaskModel, frame: pd.DataFrame, subject_id: str | None) -> PredictionResult:
    assert entry.model is not None
    raw = entry.model.predict(frame)
    value = float(np.asarray(raw, dtype=float).reshape(-1)[0])
    if not math.isfinite(value):
        return _abstain(entry, subject_id, [NON_FINITE])
    half_width = float(entry.half_width)  # đã kiểm hữu hạn ở trên
    return PredictionResult(
        task=entry.task,
        subjectId=subject_id,
        model=entry.deploy_model,
        modelVersion=entry.run_id,
        prediction=value,
        unit=entry.unit,
        interval90=Interval90(low=value - half_width, high=value + half_width),
        abstain=False,
        reasons=[],
        provenance=entry.provenance,
    )


def _predict_class(entry: TaskModel, frame: pd.DataFrame, subject_id: str | None) -> PredictionResult:
    assert entry.model is not None
    label = str(np.asarray(entry.model.predict(frame)).reshape(-1)[0])
    classes = list(entry.classes or entry.model.classes_)
    proba = entry.model.predict_proba(frame)
    columns = [str(c) for c in entry.model.classes_]
    frame_proba = pd.DataFrame(proba, columns=columns).reindex(columns=classes, fill_value=0.0)
    probabilities = {name: float(frame_proba.iloc[0][name]) for name in classes}
    return PredictionResult(
        task=entry.task,
        subjectId=subject_id,
        model=entry.deploy_model,
        modelVersion=entry.run_id,
        prediction=None,
        unit=entry.unit,
        interval90=None,
        abstain=False,
        reasons=[],
        provenance=entry.provenance,
        label=label,
        probabilities=probabilities,
    )

"""Hợp đồng HTTP v1 (pydantic v2) — camelCase ở chỗ spec đặt camelCase.

`PredictionResult` mirror `sky_ml/5_predict.py::predict_rows`:
- hồi quy: `prediction` + `interval90` (nửa độ rộng split-conformal từ OOF);
- phân loại (`sleep`): `prediction = null`, nhãn ở `label`, xác suất ở `probabilities`,
  `interval90 = null` (đúng như `predict_rows` không sinh low90/high90 cho classification).
"""

from __future__ import annotations

import math

from pydantic import BaseModel, ConfigDict, Field, field_validator

MAX_HISTORY = 512


def _require_finite(values: dict[str, float], what: str) -> dict[str, float]:
    bad = sorted(k for k, v in values.items() if not math.isfinite(v))
    if bad:
        raise ValueError(f"{what} phải là số hữu hạn (không NaN/Inf): {bad}")
    return values


class PredictRequest(BaseModel):
    """Một yêu cầu dự báo. `subject_id` chỉ là định danh hư cấu (demo), không phải PHI."""

    model_config = ConfigDict(extra="forbid")

    task: str = Field(min_length=1, description="tên task trong data/configs/tasks.yaml")
    subject_id: str | None = Field(default=None, description="định danh hư cấu, chỉ để echo lại")
    features: dict[str, float] = Field(
        default_factory=dict,
        description="bảng đặc trưng của task (xem /v1/models/<task>); khoá lạ ⇒ 422",
    )
    history: list[float] | None = Field(
        default=None,
        max_length=MAX_HISTORY,
        description="chuỗi quá khứ cũ→mới, cùng đơn vị với task; cần cho mô hình history "
        "(personal_mean/mean_delta)",
    )

    @field_validator("features")
    @classmethod
    def _finite_features(cls, v: dict[str, float]) -> dict[str, float]:
        return _require_finite(v, "features")

    @field_validator("history")
    @classmethod
    def _finite_history(cls, v: list[float] | None) -> list[float] | None:
        if v is not None and any(not math.isfinite(x) for x in v):
            raise ValueError("history phải là các số hữu hạn (không NaN/Inf)")
        return v


class BatchRequest(BaseModel):
    """Tối đa `MAX_BATCH_ITEMS` mục; kết quả giữ NGUYÊN thứ tự đầu vào."""

    model_config = ConfigDict(extra="forbid")

    items: list[PredictRequest] = Field(default_factory=list, max_length=64)


class Interval90(BaseModel):
    low: float
    high: float


class PredictionResult(BaseModel):
    task: str
    subjectId: str | None = None
    model: str
    modelVersion: str
    prediction: float | None
    unit: str | None
    interval90: Interval90 | None
    abstain: bool
    reasons: list[str]
    provenance: str
    # Phân loại (sleep): nhãn lớp + xác suất; hồi quy: null.
    label: str | None = None
    probabilities: dict[str, float] | None = None


class BatchResponse(BaseModel):
    results: list[PredictionResult]


class ModelSummary(BaseModel):
    task: str
    model: str
    modelVersion: str
    unit: str | None
    kind: str
    state: str  # ready | unavailable
    reason: str | None = None


class ModelsResponse(BaseModel):
    models: list[ModelSummary]


class TaskDetail(BaseModel):
    """Metadata + hợp đồng đặc trưng của một task (dùng để gọi /v1/predict đúng)."""

    model_config = ConfigDict(populate_by_name=True)

    task: str
    description: str | None
    kind: str
    unit: str | None
    state: str
    reason: str | None
    deploy_model: str | None = Field(default=None, alias="deployModel")
    run_id: str | None = Field(default=None, alias="runId")
    features: list[str] | None
    feature_count: int | None = Field(default=None, alias="featureCount")
    history_required: bool = Field(default=False, alias="historyRequired")
    history_mode: str | None = Field(default=None, alias="historyMode")
    interval_alpha: float | None = Field(default=None, alias="intervalAlpha")
    interval_half_width_90: float | None = Field(default=None, alias="intervalHalfWidth90")
    classes: list[str] | None
    train_rows: int | None = Field(default=None, alias="trainRows")
    sha256: str | None
    provenance: str


class UnavailableTask(BaseModel):
    task: str
    reason: str


class HealthResponse(BaseModel):
    ok: bool
    service: str
    modelsTotal: int
    modelsReady: int
    tasksUnavailable: list[UnavailableTask]
    dataRoot: str
    error: str | None = None

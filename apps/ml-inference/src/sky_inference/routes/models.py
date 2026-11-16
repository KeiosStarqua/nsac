"""`GET /v1/models` và `GET /v1/models/{task}` — danh mục + hợp đồng đặc trưng."""

from __future__ import annotations

import math

from fastapi import APIRouter, HTTPException, Request

from ..registry import Registry, TaskModel
from ..schemas import ModelsResponse, ModelSummary, TaskDetail

router = APIRouter(tags=["models"])


def resolve_task(registry: Registry, task: str) -> TaskModel:
    """404 `unknown_task` nếu task không có artifact; 503 nếu task có nhưng nạp lỗi."""
    entry = registry.get(task)
    if entry is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "unknown_task", "task": task, "available": sorted(registry.tasks)},
        )
    if not entry.ready:
        raise HTTPException(
            status_code=503,
            detail={"code": "task_unavailable", "task": task, "reason": entry.reason},
        )
    return entry


@router.get("/v1/models", response_model=ModelsResponse)
def list_models(request: Request) -> ModelsResponse:
    registry: Registry = request.app.state.registry
    models = [
        ModelSummary(
            task=entry.task,
            model=entry.deploy_model,
            modelVersion=entry.run_id,
            unit=entry.unit,
            kind=entry.kind,
            state=entry.state,
            reason=entry.reason,
        )
        for entry in registry.tasks.values()
    ]
    return ModelsResponse(models=models)


@router.get("/v1/models/{task}", response_model=TaskDetail)
def task_detail(task: str, request: Request) -> TaskDetail:
    registry: Registry = request.app.state.registry
    entry = registry.get(task)
    if entry is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "unknown_task", "task": task, "available": sorted(registry.tasks)},
        )
    # Task unavailable vẫn trả metadata (state=unavailable, reason) để client chẩn đoán tại sao.
    return TaskDetail(
        task=entry.task,
        description=entry.description,
        kind=entry.kind,
        unit=entry.unit,
        state=entry.state,
        reason=entry.reason,
        deployModel=entry.deploy_model or None,
        runId=entry.run_id or None,
        features=list(entry.features) or None,
        featureCount=len(entry.features) or None,
        historyRequired=entry.history_required,
        historyMode=entry.history_mode,
        intervalAlpha=entry.interval_alpha,
        intervalHalfWidth90=(
            entry.half_width if entry.half_width is not None and math.isfinite(entry.half_width) else None
        ),
        classes=list(entry.classes) if entry.classes else None,
        trainRows=entry.train_rows,
        sha256=entry.sha256,
        provenance=entry.provenance,
    )

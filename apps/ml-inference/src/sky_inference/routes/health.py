"""`GET /health` — luôn 200 khi process còn sống; độ sẵn sàng nằm BÊN TRONG body.

Một task lỗi không được làm process chết (yêu cầu của spec): `modelsReady` + `tasksUnavailable`
cho biết cái gì dùng được, `ok` vẫn true.
"""

from __future__ import annotations

from fastapi import APIRouter, Request

from .. import SERVICE_NAME
from ..schemas import HealthResponse, UnavailableTask

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health(request: Request) -> HealthResponse:
    registry = request.app.state.registry
    return HealthResponse(
        ok=True,
        service=SERVICE_NAME,
        modelsTotal=registry.total,
        modelsReady=registry.ready,
        tasksUnavailable=[UnavailableTask(task=name, reason=reason) for name, reason in registry.unavailable],
        dataRoot=registry.data_root,
        error=registry.error,
    )

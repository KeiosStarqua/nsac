"""FastAPI app: registry nạp MỘT LẦN trong lifespan, route mỏng, không đọc DB/không ghi đĩa."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from . import SERVICE_NAME, __version__
from .config import load_settings
from .registry import build_registry
from .routes import health, models, predictions

log = logging.getLogger(__name__)

#: Ghi chú pháp lý/ngữ cảnh hiện trên /openapi.json (demo, không phải thiết bị y tế).
DESCRIPTION = (
    "Sky ML inference service — dự báo từ 26 mô hình đã train trong `data/3_models`.\n\n"
    "AI chỉ HỖ TRỢ: mọi phát hiện là tất định, phi hành gia xác nhận trước khi hành động. "
    "Dữ liệu analog tổng hợp cho demo — không thay thế bác sĩ."
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = load_settings()
    log.info("khởi động %s %s (data_root=%s)", SERVICE_NAME, __version__, settings.data_root)
    # Không raise khi một task lỗi: /health báo tasksUnavailable.
    app.state.settings = settings
    app.state.registry = build_registry(settings)
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="Sky ML Inference",
        version=__version__,
        description=DESCRIPTION,
        lifespan=lifespan,
    )
    app.include_router(health.router)
    app.include_router(models.router)
    app.include_router(predictions.router)
    return app


app = create_app()

"""Fixture dùng chung: trỏ service vào submodule `data/` của repo, client TestClient có lifespan.

Không đọc/ghi gì vào submodule (chỉ đọc artifact); mọi file tạm đi vào `tmp_path`.
"""

from __future__ import annotations

import os
from pathlib import Path

import pandas as pd
import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_ROOT = REPO_ROOT / "data"

# Đặt TRƯỚC khi import sky_inference/sky_ml trong các test module khác.
os.environ.setdefault("SKY_DATA_ROOT", str(DATA_ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from sky_inference.config import load_settings  # noqa: E402

load_settings()  # nạp cấu hình + chèn SKY_ML_SRC vào sys.path TRƯỚC khi import app

from sky_inference.main import app  # noqa: E402
from sky_inference.model_loader import latest_run_dir, read_manifest  # noqa: E402


@pytest.fixture(scope="session")
def data_root() -> Path:
    if not (DATA_ROOT / "configs" / "tasks.yaml").exists():
        pytest.skip(f"thiếu {DATA_ROOT}/configs/tasks.yaml (submodule data/ chưa init)")
    return DATA_ROOT


@pytest.fixture(scope="session")
def client(data_root: Path) -> TestClient:
    load_settings()  # nạp cấu hình + chèn SKY_ML_SRC vào sys.path
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def registry(client: TestClient):
    return client.app.state.registry


@pytest.fixture(scope="session")
def run_dirs(data_root: Path) -> dict[str, Path]:
    models_root = data_root / "data" / "3_models"
    return {p.name: latest_run_dir(p) for p in sorted(models_root.iterdir()) if p.is_dir()}


@pytest.fixture(scope="session")
def manifests(run_dirs: dict[str, Path]) -> dict[str, dict]:
    return {task: read_manifest(run) for task, run in run_dirs.items()}


@pytest.fixture(scope="session")
def tables(manifests: dict[str, dict], data_root: Path) -> dict[str, pd.DataFrame]:
    """Bảng đặc trưng đã train của từng task — đọc MỘT LẦN cho cả phiên test."""

    def load(task: str) -> pd.DataFrame:
        path = data_root / manifests[task]["features_table"]
        return pd.read_csv(path)

    cache: dict[str, pd.DataFrame] = {}

    class _Tables:
        def __getitem__(self, task: str) -> pd.DataFrame:
            if task not in cache:
                cache[task] = load(task)
            return cache[task]

    return _Tables()  # type: ignore[return-value]


def fixture_row(
    task: str, tables, manifests: dict[str, dict], index: int = 0
) -> tuple[dict[str, float], dict]:
    """Hàng thứ `index` của bảng train → (features dict, cả hàng). Chỉ lấy cột trong hợp đồng."""
    frame = tables[task]
    features = list(manifests[task]["features"])
    row = frame.iloc[index]
    return {name: float(row[name]) for name in features}, row.to_dict()

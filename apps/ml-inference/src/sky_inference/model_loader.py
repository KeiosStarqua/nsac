"""Nạp mô-đun `sky_ml` (mã nguồn trong submodule `data/`) và artifact joblib.

`_artifacts.load_model` là nguồn sự thật: nó đọc `manifest.json`, so SHA-256 rồi mới `joblib.load`.
Service KHÔNG tự `joblib.load` để không bỏ qua bước kiểm hash.

Tên mô-đun bắt đầu bằng chữ số (`5_predict`, `2_build_features/`) ⇒ phải nạp bằng `importlib`,
đúng cách `sky_ml/_steps.py` làm.
"""

from __future__ import annotations

import importlib
import json
from functools import lru_cache
from pathlib import Path
from types import ModuleType
from typing import Any

import pandas as pd
import yaml


@lru_cache(maxsize=1)
def sky_ml_modules() -> dict[str, ModuleType]:
    """Nạp một lần các mô-đun sky_ml mà service dùng (không kéo mne/shap)."""
    return {
        "artifacts": importlib.import_module("sky_ml._artifacts"),
        "predict": importlib.import_module("sky_ml.5_predict"),
        "windows": importlib.import_module("sky_ml.2_build_features.windows"),
    }


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def latest_run_dir(task_models_dir: Path) -> Path:
    """Run mới nhất = tên thư mục lớn nhất (run_id dạng `YYYY-MM-DD_HHMMSS`, sort ISO là đúng).

    Pin run ở startup — KHÔNG chọn lại deploy_model theo điểm test.
    """
    runs = sorted(p for p in task_models_dir.iterdir() if p.is_dir())
    if not runs:
        raise FileNotFoundError(f"chưa có run nào trong {task_models_dir}")
    return runs[-1]


def read_manifest(run_dir: Path) -> dict:
    path = run_dir / "manifest.json"
    if not path.exists():
        raise FileNotFoundError(f"thiếu {path}")
    return read_json(path)


def manifest_entry(manifest: dict, model: str, kind: str = "final") -> dict:
    entry = next(
        (m for m in manifest.get("models", []) if m.get("model") == model and m.get("kind") == kind), None
    )
    if entry is None:
        raise FileNotFoundError(f"manifest không có mô hình {model}/{kind}")
    return entry


def load_model(run_dir: Path, model: str, kind: str = "final"):
    """Nạp `<run>/<model>/final.joblib` qua `sky_ml._artifacts.load_model` (kiểm SHA-256)."""
    return sky_ml_modules()["artifacts"].load_model(run_dir, model, kind)


def sha256_file(path: Path) -> str:
    return sky_ml_modules()["artifacts"]._sha256(path)


def read_task_configs(data_root: Path) -> dict[str, dict]:
    """`data/configs/tasks.yaml` — tham số từng task (deploy_model, kind, unit, features, interval_alpha…)."""
    path = data_root / "configs" / "tasks.yaml"
    if not path.exists():
        raise FileNotFoundError(f"thiếu {path}")
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def read_train_bounds(
    manifest: dict, features: list[str], data_root: Path, task: str
) -> tuple[dict, dict, int]:
    """lo/hi per feature từ bảng đặc trưng đã train (cột min/max), nạp MỘT LẦN lúc startup.

    Chỉ dùng cho kiểm `out_of_training_range` — đúng như `predict_rows` lấy
    `train_table[features].min()/max()`.
    """
    rel = manifest.get("features_table")
    candidates = [data_root / rel] if rel else []
    candidates.append(data_root / "data" / "2_features" / task / str(manifest.get("run_id")) / "table.csv.gz")
    table = next((p for p in candidates if p.exists()), None)
    if table is None:
        raise FileNotFoundError(f"không thấy bảng đặc trưng đã train (manifest.features_table={rel})")
    frame = pd.read_csv(table, usecols=list(features))
    lo = {name: float(v) for name, v in frame.min().items()}
    hi = {name: float(v) for name, v in frame.max().items()}
    return lo, hi, int(len(frame))

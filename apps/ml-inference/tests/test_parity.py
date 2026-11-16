"""Parity với `sky_ml` gốc trên cùng một hàng bảng (table mode).

Ba lớp kiểm:
1. `predict_rows` của `sky_ml/5_predict.py` (bản tham chiếu mà service mirror) — dự báo + low90/high90;
2. mô hình joblib gọi trực tiếp trong process (`entry.model.predict`) — so với kết quả HTTP;
3. `sky-ml` CLI THẬT (`python -m sky_ml._cli predict --mode table`) chạy trong một cây dữ liệu
   copy tạm (không ghi vào submodule) — so với kết quả HTTP.
"""

from __future__ import annotations

import math
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pandas as pd
import pytest
from conftest import fixture_row

from sky_inference import model_loader
from sky_inference.model_loader import sky_ml_modules

PARITY_TASKS = ["hr", "vitals_sbp"]


def _reference(registry, tables, manifests, run_dirs, data_root: Path, task: str, features: dict[str, float]):
    """`predict_rows` của sky_ml trên đúng hàng đặc trưng, dùng đúng run/train table/half width."""
    entry = registry.get(task)
    cfg = model_loader.read_task_configs(data_root)[task]
    run_dir = run_dirs[task]
    rows = pd.DataFrame([{"subject_id": "parity-demo", **features}])
    oof = pd.read_csv(run_dir / "oof.csv.gz")
    half_width = sky_ml_modules()["predict"].calibration_half_width(
        oof, entry.deploy_model, entry.interval_alpha, entry.kind
    )
    model = model_loader.load_model(run_dir, entry.deploy_model)
    out = sky_ml_modules()["predict"].predict_rows(
        model, rows, list(entry.features), half_width, tables[task], cfg, entry.deploy_model
    )
    return out.iloc[0].to_dict()


@pytest.mark.parametrize("task", PARITY_TASKS)
def test_parity_with_predict_rows(
    task: str, client, registry, tables, manifests, run_dirs, data_root
) -> None:
    features, _ = fixture_row(task, tables, manifests, 0)
    response = client.post(
        "/v1/predict", json={"task": task, "subject_id": "parity-demo", "features": features}
    )
    assert response.status_code == 200, response.text
    got = response.json()
    want = _reference(registry, tables, manifests, run_dirs, data_root, task, features)

    assert got["abstain"] is False
    assert bool(want["abstain"]) is False
    assert math.isclose(got["prediction"], float(want["prediction"]), rel_tol=1e-9)
    assert math.isclose(got["interval90"]["low"], float(want["low90"]), rel_tol=1e-9)
    assert math.isclose(got["interval90"]["high"], float(want["high90"]), rel_tol=1e-9)


@pytest.mark.parametrize("task", PARITY_TASKS)
def test_service_matches_loaded_model(task: str, client, registry, tables, manifests) -> None:
    """Kiểm trong process: `entry.model.predict` == `POST /v1/predict`."""
    entry = registry.get(task)
    features, _ = fixture_row(task, tables, manifests, 0)
    frame = pd.DataFrame([features], columns=list(entry.features), dtype=float)
    direct = float(entry.model.predict(frame)[0])
    got = client.post("/v1/predict", json={"task": task, "features": features}).json()["prediction"]
    assert math.isclose(direct, got, rel_tol=1e-12, abs_tol=1e-12)


def _copy_tree(data_root: Path, root: Path, task: str, run_name: str) -> Path:
    """Cây dữ liệu tối thiểu để CLI chạy được — CLI ghi output vào ĐÂY, không vào submodule."""
    (root / "configs").mkdir(parents=True)
    shutil.copy2(data_root / "sky_ml.yaml", root / "sky_ml.yaml")
    for name in ("tasks.yaml", "data_dictionary.yaml", "crew_map.yaml"):
        src = data_root / "configs" / name
        if src.exists():
            shutil.copy2(src, root / "configs" / name)
    for rel in (Path("data") / "2_features" / task / run_name, Path("data") / "3_models" / task / run_name):
        shutil.copytree(data_root / rel, root / rel)
    for name in ("README.md", "CATALOG.csv"):
        src = data_root / "data" / name
        if src.exists():
            shutil.copy2(src, root / "data" / name)
    return root


@pytest.mark.cli_parity
@pytest.mark.parametrize("task", PARITY_TASKS)
def test_parity_with_sky_ml_cli(
    tmp_path: Path, task: str, client, tables, manifests, run_dirs, data_root
) -> None:
    run_name = run_dirs[task].name
    root = _copy_tree(data_root, tmp_path / "tree", task, run_name)
    features, _ = fixture_row(task, tables, manifests, 0)
    fixture = tmp_path / f"{task}.csv"
    pd.DataFrame([{"subject_id": "parity-demo", **features}]).to_csv(fixture, index=False)

    env = {**os.environ, "PYTHONPATH": str(data_root / "src"), "HOME": str(tmp_path)}
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "sky_ml._cli",
            "--config",
            str(root / "sky_ml.yaml"),
            "predict",
            task,
            "--input",
            str(fixture),
            "--mode",
            "table",
        ],
        capture_output=True,
        text=True,
        env=env,
        cwd=str(root),
        timeout=300,
    )
    if result.returncode != 0:
        pytest.fail(f"sky-ml CLI lỗi ({result.returncode}):\n{result.stdout}\n{result.stderr}")

    out_dir = root / "data" / "4_predictions" / task / run_name
    csvs = sorted(out_dir.glob("*.csv"))
    assert len(csvs) == 1, f"CLI phải ghi đúng một file dự báo trong {out_dir}"
    cli_row = pd.read_csv(csvs[0]).iloc[0]

    got = client.post("/v1/predict", json={"task": task, "features": features}).json()
    assert got["abstain"] is False
    assert bool(cli_row["abstain"]) is False
    assert math.isclose(got["prediction"], float(cli_row["prediction"]), rel_tol=1e-6)
    assert math.isclose(got["interval90"]["low"], float(cli_row["low90"]), rel_tol=1e-6)
    assert math.isclose(got["interval90"]["high"], float(cli_row["high90"]), rel_tol=1e-6)

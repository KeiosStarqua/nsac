"""`interval90`: nửa độ rộng split-conformal lấy từ sai số OOF của CHÍNH run đã train.

Không tự viết lại công thức: gọi thẳng `sky_ml/5_predict.py::calibration_half_width`
(→ `sky_ml/4_evaluate.py::interval_half_width`, phân vị bậc `ceil((n+1)(1-alpha))` của |sai số|).
Phân loại → `NaN` (không có khoảng), đúng như `predict_rows`.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from .model_loader import sky_ml_modules


def read_oof(run_dir: Path) -> pd.DataFrame:
    """`<run>/oof.csv.gz` — dự báo out-of-fold của mọi mô hình trong run."""
    path = run_dir / "oof.csv.gz"
    if not path.exists():
        raise FileNotFoundError(f"thiếu {path}")
    return pd.read_csv(path)


def calibration_half_width(oof: pd.DataFrame, model: str, alpha: float, kind: str) -> float:
    return sky_ml_modules()["predict"].calibration_half_width(oof, model, alpha, kind)

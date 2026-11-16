"""Dựng bảng đặc trưng cho một yêu cầu — v1: DANH TÍNH (identity) + mở rộng từ `history`.

v1 KHÔNG dựng cửa sổ từ chuỗi telemetry thô (cắt window `past/future/step` từ cảm biến):
đó là vòng sau. Ở đây:
1. `features` do client gửi được dùng nguyên (đã kiểm hữu hạn + khoá hợp lệ ở route).
2. Thiếu đặc trưng nào mà `history` suy ra được thì tính bằng ĐÚNG hàm của lúc train
   (`sky_ml/2_build_features/windows.py::FEATURES`, vd. `mean_all`, `last_value`, `std_all`…).
3. Còn thiếu ⇒ `missing_features` (trừ mô hình hằng số, xem `TaskModel.ignores_features`).
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from functools import lru_cache

import numpy as np

from .model_loader import sky_ml_modules


@lru_cache(maxsize=1)
def history_feature_names() -> frozenset[str]:
    """Tên đặc trưng windows của sky_ml (`last_value`, `mean_last_5`, `mean_all`, `std_all`,
    `change_last_10`, `min_all`, `max_all`, …). Mọi tên này đều là hàm của cửa sổ quá khứ.

    Nạp TRỄ (lru_cache) để import package không cần `sky_ml` trên sys.path trước `load_settings()`.
    """
    return frozenset(sky_ml_modules()["windows"].FEATURES)


def history_features(history: Sequence[float], names: Iterable[str]) -> dict[str, float]:
    """Tính các đặc trưng dạng cửa sổ từ `history` (cũ→mới) bằng hàm của sky_ml.

    `std_all` giữ nguyên `numpy.std()` (ddof=0) như lúc train — đừng đổi sang pandas.
    """
    derivable = history_feature_names()
    wanted = [n for n in names if n in derivable]
    if not wanted or not history:
        return {}
    x = np.asarray(history, dtype=float)
    return {
        name: float(value) for name, value in sky_ml_modules()["windows"].window_features(x, wanted).items()
    }


def resolve_features(
    required: Sequence[str],
    provided: dict[str, float],
    history: Sequence[float] | None,
) -> tuple[dict[str, float], list[str]]:
    """Trả (đặc trưng đã có, tên đặc trưng còn thiếu) — không kiểm khoảng, không quyết định abstain."""
    resolved = {name: float(provided[name]) for name in required if name in provided}
    if history:
        for name, value in history_features(history, required).items():
            resolved.setdefault(name, value)
    missing = [name for name in required if name not in resolved]
    return resolved, missing


def unknown_keys(required: Sequence[str], provided: dict[str, float]) -> list[str]:
    """Khoá client gửi mà task không có trong hợp đồng ⇒ route trả 422 (schema mismatch)."""
    return sorted(set(provided) - set(required))

"""Cấu hình service — đọc từ env, mặc định suy ra từ vị trí cài đặt.

| Env | Mặc định | Ý nghĩa |
|---|---|---|
| `SKY_DATA_ROOT` | `<repo>/data` (suy ra từ vị trí package) | gốc dữ liệu sky-ml: `configs/`,
  `data/2_features`, `data/3_models`, `src/sky_ml` |
| `SKY_ML_SRC` | `<SKY_DATA_ROOT>/src` | nơi có package `sky_ml` (chèn vào `sys.path`) |
| `SKY_INFERENCE_HOST` | `127.0.0.1` | chỉ loopback; backend Bun gọi nội bộ |
| `SKY_INFERENCE_PORT` | `8100` | cổng HTTP |

Trong nix (`.#inference`) wrapper ĐẶT SẴN `SKY_DATA_ROOT` = store path của input `nsac-data`,
nên service không phụ thuộc checkout nào trên box.
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from pathlib import Path

SERVICE_DIR = Path(__file__).resolve().parent  # .../src/sky_inference
# .../apps/ml-inference/src/sky_inference → parents: [0]=src, [1]=ml-inference, [2]=apps, [3]=<repo>
_REPO_ROOT = SERVICE_DIR.parents[3]
DEFAULT_DATA_ROOT = _REPO_ROOT / "data"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8100
MAX_BATCH_ITEMS = 64


@dataclass(frozen=True)
class Settings:
    data_root: Path
    sky_ml_src: Path
    host: str
    port: int
    max_batch_items: int = MAX_BATCH_ITEMS

    @property
    def tasks_config(self) -> Path:
        return self.data_root / "configs" / "tasks.yaml"

    @property
    def models_dir(self) -> Path:
        return self.data_root / "data" / "3_models"

    @property
    def features_dir(self) -> Path:
        return self.data_root / "data" / "2_features"


def bootstrap_sky_ml(src: Path) -> None:
    """Chèn `src` (chứa package `sky_ml`) vào đầu `sys.path`.

    sky_ml là mã nguồn thuần trong submodule `data/`: mô-đun đánh số (`5_predict.py`,
    `2_build_features/`) được nạp bằng importlib đúng như `sky_ml/_steps.py` làm, nên chỉ cần
    thư mục `src` trên sys.path. Không cài qua uv path source (xem pyproject.toml).
    """
    entry = str(src)
    if entry not in sys.path:
        sys.path.insert(0, entry)


def load_settings() -> Settings:
    data_root = Path(os.environ.get("SKY_DATA_ROOT") or DEFAULT_DATA_ROOT).expanduser()
    data_root = data_root.resolve()
    sky_ml_src = Path(os.environ.get("SKY_ML_SRC") or (data_root / "src")).expanduser().resolve()
    bootstrap_sky_ml(sky_ml_src)
    return Settings(
        data_root=data_root,
        sky_ml_src=sky_ml_src,
        host=os.environ.get("SKY_INFERENCE_HOST", DEFAULT_HOST),
        port=int(os.environ.get("SKY_INFERENCE_PORT", DEFAULT_PORT)),
    )

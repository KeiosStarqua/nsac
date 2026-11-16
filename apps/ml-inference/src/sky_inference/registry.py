"""Registry: quét `data/3_models/<task>/<run mới nhất>` lúc startup, nạp `deploy_model` + hợp đồng.

Nguyên tắc:
- LUÔN dùng `deploy_model` trong `configs/tasks.yaml` (không phải `best_model`), pin run mới nhất.
- Một task lỗi KHÔNG được làm chết process: ghi `state="unavailable"` + `reason`, `/health` vẫn 200.
- `interval90` = split-conformal từ `oof.csv.gz` của chính run (xem `uncertainty.py`).
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field

from . import model_loader, uncertainty
from .config import Settings

log = logging.getLogger(__name__)

# Lớp deploy ⇒ cách service lấy đặc trưng:
# - LastValue (personal_mean = LastValue trên cột mean_all): đặc trưng suy từ `history`;
#   Dự báo = đúng mô hình đã lưu chạy trên hàng đặc trưng đó.
# - Dummy (mean_delta / persistence): hằng số = trung bình target của tập train, KHÔNG đọc
#   đặc trưng (xem sky_ml/_models.py + 3_train.py: DummyRegressor(strategy="mean")).
HISTORY_DERIVED = "derived"
HISTORY_CONSTANT = "constant"

_LAST_VALUE_CLASS = "sky_ml._models.LastValue"
_DUMMY_CLASSES = {"sklearn.dummy.DummyRegressor", "sklearn.dummy.DummyClassifier"}


@dataclass(frozen=True)
class TaskModel:
    task: str
    kind: str
    unit: str | None
    description: str | None
    deploy_model: str
    run_id: str
    features: tuple[str, ...]
    history_mode: str | None  # None | derived | constant
    interval_alpha: float
    classes: tuple[str, ...] | None
    half_width: float | None
    train_min: dict[str, float] | None
    train_max: dict[str, float] | None
    train_rows: int | None
    sha256: str | None
    state: str
    reason: str | None
    provenance: str
    model: object | None = field(default=None, repr=False, compare=False)

    @property
    def ready(self) -> bool:
        return self.state == "ready"

    @property
    def history_required(self) -> bool:
        return self.history_mode is not None

    @property
    def ignores_features(self) -> bool:
        """Mô hình hằng số không đọc đặc trưng ⇒ thiếu cột không phải lý do abstain."""
        return self.history_mode == HISTORY_CONSTANT

    @property
    def is_classification(self) -> bool:
        return self.kind == "classification"


@dataclass(frozen=True)
class Registry:
    tasks: dict[str, TaskModel]
    data_root: str
    error: str | None = None

    @property
    def total(self) -> int:
        return len(self.tasks)

    @property
    def ready(self) -> int:
        return sum(1 for t in self.tasks.values() if t.ready)

    @property
    def unavailable(self) -> list[tuple[str, str]]:
        return [(t.task, t.reason or "unknown") for t in self.tasks.values() if not t.ready]

    def get(self, task: str) -> TaskModel | None:
        return self.tasks.get(task)


def _history_mode(model_spec: dict) -> str | None:
    cls = str(model_spec.get("class", ""))
    if cls == _LAST_VALUE_CLASS:
        return HISTORY_DERIVED
    if cls in _DUMMY_CLASSES:
        return HISTORY_CONSTANT
    return None


def _provenance(task: str, run_id: str, deploy: str, sha: str | None, alpha: float, kind: str) -> str:
    base = (
        f"sky-ml data/3_models/{task}/{run_id}/{deploy}/final.joblib"
        f" (sha256 {sha or 'n/a'}, run {run_id}); deploy_model từ data/configs/tasks.yaml"
    )
    if kind == "classification":
        return base + "; nhãn + xác suất lớp từ predict_proba; interval90 = null (mirror sky_ml/5_predict.py)"
    return (
        base
        + f"; interval90 = split-conformal |OOF residual| quantile, alpha {alpha} "
        + "(sky_ml/5_predict.py::calibration_half_width → 4_evaluate.py::interval_half_width); "
        + "dữ liệu analog tổng hợp cho demo, KHÔNG dùng cho quyết định lâm sàng"
    )


def _load_task(task: str, task_cfg: dict, settings: Settings) -> TaskModel:
    kind = str(task_cfg.get("kind", "regression"))
    unit = task_cfg.get("unit")
    deploy = task_cfg.get("deploy_model")
    if not deploy:
        raise ValueError("configs/tasks.yaml không có deploy_model cho task này")
    run_dir = model_loader.latest_run_dir(settings.models_dir / task)
    manifest = model_loader.read_manifest(run_dir)
    run_id = str(manifest.get("run_id") or run_dir.name)
    features = tuple(manifest.get("features") or ())
    if not features:
        raise ValueError(f"manifest {run_dir.name} không có danh sách features")
    specs = manifest.get("model_specs") or {}
    if deploy not in specs:
        raise ValueError(f"deploy_model '{deploy}' không có trong manifest.model_specs")
    history_mode = _history_mode(specs.get(deploy) or {})
    alpha = float(task_cfg.get("interval_alpha", 0.10))
    classes = tuple(task_cfg["classes"]) if task_cfg.get("classes") else None
    entry = model_loader.manifest_entry(manifest, deploy)
    sha = str(entry.get("sha256") or "") or None

    model = model_loader.load_model(run_dir, deploy)  # kiểm SHA-256 theo manifest trước khi nạp

    half_width: float | None = None
    if kind != "classification":
        oof = uncertainty.read_oof(run_dir)
        half_width = uncertainty.calibration_half_width(oof, deploy, alpha, kind)

    train_min, train_max, train_rows = model_loader.read_train_bounds(
        manifest, list(features), settings.data_root, task
    )

    return TaskModel(
        task=task,
        kind=kind,
        unit=str(unit) if unit is not None else None,
        description=task_cfg.get("description"),
        deploy_model=str(deploy),
        run_id=run_id,
        features=features,
        history_mode=history_mode,
        interval_alpha=alpha,
        classes=classes,
        half_width=half_width,
        train_min=train_min,
        train_max=train_max,
        train_rows=train_rows,
        sha256=sha,
        state="ready",
        reason=None,
        provenance=_provenance(task, run_id, str(deploy), sha, alpha, kind),
        model=model,
    )


def _unavailable(task: str, task_cfg: dict | None, reason: str) -> TaskModel:
    cfg = task_cfg or {}
    return TaskModel(
        task=task,
        kind=str(cfg.get("kind", "unknown")),
        unit=cfg.get("unit"),
        description=cfg.get("description"),
        deploy_model=str(cfg.get("deploy_model") or ""),
        run_id="",
        features=(),
        history_mode=None,
        interval_alpha=float(cfg.get("interval_alpha", 0.10)),
        classes=None,
        half_width=None,
        train_min=None,
        train_max=None,
        train_rows=None,
        sha256=None,
        state="unavailable",
        reason=reason,
        provenance="unavailable",
    )


def build_registry(settings: Settings) -> Registry:
    """Quét toàn bộ task có artifact. Lỗi ở một task → unavailable, không raise."""
    task_cfgs: dict[str, dict] = {}
    error: str | None = None
    try:
        task_cfgs = model_loader.read_task_configs(settings.data_root)
    except Exception as exc:  # noqa: BLE001 - process phải sống, /health báo lỗi
        error = f"{type(exc).__name__}: {exc}"
        log.error("registry: không đọc được tasks.yaml (%s)", error)

    tasks: dict[str, TaskModel] = {}
    models_root = settings.models_dir
    try:
        task_dirs = sorted(p for p in models_root.iterdir() if p.is_dir())
    except Exception as exc:  # noqa: BLE001
        error = error or f"{type(exc).__name__}: {exc}"
        log.error("registry: không đọc được %s (%s)", models_root, error)
        task_dirs = []

    for task_dir in task_dirs:
        task = task_dir.name
        cfg = task_cfgs.get(task)
        if cfg is None:
            tasks[task] = _unavailable(task, None, "task_not_in_tasks_yaml")
            continue
        if cfg.get("kind") == "descriptive":
            tasks[task] = _unavailable(task, cfg, "descriptive_task_has_no_model")
            continue
        try:
            tasks[task] = _load_task(task, cfg, settings)
        except Exception as exc:  # noqa: BLE001
            reason = f"{type(exc).__name__}: {exc}"
            tasks[task] = _unavailable(task, cfg, reason)
            log.error("registry: task %s UNAVAILABLE (%s)", task, reason)

    reg = Registry(tasks=tasks, data_root=str(settings.data_root), error=error)
    log.info(
        "registry: %d task, %d ready, %d unavailable (data_root=%s)",
        reg.total,
        reg.ready,
        reg.total - reg.ready,
        settings.data_root,
    )
    for name, reason in reg.unavailable:
        log.warning("registry: unavailable %s — %s", name, reason)
    return reg


def is_finite(value: float | None) -> bool:
    return value is not None and math.isfinite(value)

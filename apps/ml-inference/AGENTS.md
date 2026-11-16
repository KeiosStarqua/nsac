# Sky ML inference — `apps/ml-inference`

## Purpose

FastAPI service phục vụ **26 mô hình đã train** của pipeline `sky-ml` (submodule `data/`) qua HTTP
trên `127.0.0.1:8100`. Nó chỉ suy luận: đọc artifact trong `data/3_models`, kiểm SHA-256, trả dự báo
+ khoảng 90% hoặc **abstain kèm lý do**. Không train, không ghi dữ liệu, không giữ trạng thái.
Backend Bun (`apps/backend`) sẽ gọi service này ở vòng sau; agent bác sĩ (doctor agents) chưa có.

## Ownership

- Toàn bộ `apps/ml-inference/` do feature này sở hữu: `pyproject.toml` + `uv.lock`, `src/sky_inference/`,
  `tests/`, `README.md`, file này.
- Đầu vào dữ liệu thuộc submodule `data/` (CHỈ ĐỌC — sửa artifact là sửa ở repo `nsac-data` rồi bump
  pointer). Wiring hạ tầng thuộc root: `flake.nix` (`.#inference`, `.#inferenceWheels`),
  `scripts/deploy.sh`, `scripts/nix-gc.sh`, `ops/nsac-inference.service`.

## Local Contracts

### Env

| Env | Mặc định | Ý nghĩa |
|---|---|---|
| `SKY_DATA_ROOT` | `<repo>/data` (suy ra từ vị trí package) | gốc sky-ml: `configs/tasks.yaml`, `data/2_features`, `data/3_models`, `src/sky_ml` |
| `SKY_ML_SRC` | `<SKY_DATA_ROOT>/src` | nơi có package `sky_ml`, được chèn vào `sys.path` |
| `SKY_INFERENCE_HOST` | `127.0.0.1` | chỉ loopback |
| `SKY_INFERENCE_PORT` | `8100` | cổng |

Trong nix, wrapper `bin/sky-inference` **đặt sẵn** `SKY_DATA_ROOT` = store path của flake input
`nsac-data` (không phải checkout trên box) ⇒ đổi artifact = bump input + submodule, không rsync dữ liệu.

### `sky_ml` không phải dependency uv

`sky_ml` là mã nguồn thuần trong `data/src` và được nạp qua `sys.path` (`SKY_ML_SRC`), **không** khai
báo `[tool.uv.sources] sky-ml = { path = ... }`. Lý do (đo được): path source kéo nguyên bộ dependency
*training* của `data/pyproject.toml` (mne, shap, matplotlib → numba/llvmlite, +~150 MB) vào venv deploy
và làm hash FOD phụ thuộc nội dung `data/`. Không có chỗ nào trong service import mne/shap/matplotlib;
`sky_ml.2_build_features.sleep` chỉ `import mne` bên trong hàm. `tests/` và `uv run` cũng dùng `sys.path`
nên môi trường dev trùng với môi trường deploy.

### Registry (dựng MỘT LẦN ở startup, trong `lifespan`)

- Đọc `data/configs/tasks.yaml` (pyyaml) → `deploy_model` (KHÔNG phải `best_model`/`best_model_exploratory`),
  `kind`, `unit`, `interval_alpha` (mặc định `0.10`), `classes`.
- Run được **pin**: thư mục con lớn nhất theo tên dưới `data/3_models/<task>/` (run id `YYYY-MM-DD_HHMMSS`,
  sort ISO là đúng). Không chọn lại mô hình theo điểm test.
- Nạp `<run>/<deploy_model>/final.joblib` **qua `sky_ml._artifacts.load_model`** — hàm đó đọc
  `manifest.json`, so SHA-256 rồi mới `joblib.load`. Service không bao giờ `joblib.load` trực tiếp.
- Nửa độ rộng 90%: `sky_ml/5_predict.py::calibration_half_width` gọi trên `oof.csv.gz` của chính run
  (→ `sky_ml/4_evaluate.py::interval_half_width`, phân vị `ceil((n+1)(1-alpha))` của |sai số| OOF).
  Hồi quy mới có; phân loại (`sleep`) ⇒ `interval90 = null`.
- Min/max từng đặc trưng: nạp một lần từ bảng đã train (`manifest.features_table`, dự phòng
  `data/2_features/<task>/<run>/table.csv.gz`) — chỉ dùng cho `out_of_training_range`.
- **Task lỗi không làm chết process**: ghi `state="unavailable"` + `reason`, `/health` vẫn 200 với
  `modelsReady` + `tasksUnavailable`.

### Hợp đồng abstain (mirror `sky_ml/5_predict.py::predict_rows`)

Thứ tự reason: `missing_features` (thiếu/NaN đặc trưng) → `out_of_training_range` (ngoài min/max tập
train, KHÔNG ngoại suy) → `insufficient_calibration_data` (hồi quy mà nửa độ rộng không hữu hạn).
Riêng mô hình cần `history`: thiếu `history` ⇒ short-circuit `reasons = ["history_required"]`.
`non_finite_prediction` là lưới an toàn để không bao giờ phát `NaN` ra JSON (bản gốc không có nhánh này).

### `history` và hai họ mô hình "cần lịch sử"

Suy ra từ `model_specs[deploy_model].class` của manifest:

- `sky_ml._models.LastValue` — họ `personal_mean` (= `LastValue(column="mean_all")`): dự báo = **trung
  bình `history`**. Đặc trưng thiếu được tính từ `history` bằng đúng hàm lúc train
  (`sky_ml/2_build_features/windows.py::FEATURES`: `last_value`, `mean_all`, `std_all` (numpy `std`, ddof=0),
  `min_all`, `max_all`, `mean_last_5`, `change_last_10`).
- `sklearn.dummy.DummyRegressor` — họ `mean_delta`/`persistence`: mô hình là **hằng số** = trung bình
  target của tập train (xem `sky_ml/_models.py` + `3_train.py`); nó không đọc đặc trưng. Vì vậy `history`
  chỉ là cổng hợp đồng, còn dự báo = hằng số đã học; đặc trưng client gửi (nếu có) vẫn bị kiểm khoảng.

16/26 task cần `history`. `GET /v1/models/<task>` trả `historyRequired` + `historyMode`
(`derived` | `constant`) để client biết trước.

### Feature builder v1 = identity

`feature_builder.py` nhận `features` dict đã đúng hợp đồng và mở rộng từ `history`. Việc **dựng cửa sổ
từ chuỗi telemetry thô** (cắt `past/future/step`, lọc `valid_hr_range`, nội suy) là vòng sau — cố ý
không làm ở đây, và không được lặng lẽ nội suy.

### HTTP (v1)

| Route | Ghi chú |
|---|---|
| `GET /health` | luôn 200 khi process sống; `ok`, `service`, `modelsTotal`, `modelsReady`, `tasksUnavailable[]`, `dataRoot`, `error` |
| `GET /v1/models` | `{models: [{task, model, modelVersion, unit, kind, state, reason?}]}` |
| `GET /v1/models/{task}` | metadata + hợp đồng đặc trưng; 404 `unknown_task`; task lỗi vẫn trả metadata với `state=unavailable` |
| `POST /v1/predict` | `{task, subject_id?, features, history?}` → `PredictionResult` |
| `POST /v1/predict/batch` | `{items: [...]}`, tối đa **64** mục (65 ⇒ 422), kết quả giữ nguyên thứ tự |

Khoá `features` lạ ⇒ **422** (`code: "unknown_feature"`); thiếu khoá hợp lệ ⇒ abstain `missing_features`.
Task có nhưng nạp lỗi ⇒ 503 `task_unavailable`. Phân loại: `prediction = null`, `label` + `probabilities`,
`interval90 = null` (giữ `prediction` là số theo spec).

`subject_id` chỉ là định danh **hư cấu** cho demo; log không in giá trị đặc trưng của người thật.
Mọi dự báo kèm `provenance` (file, sha256, run, cách tính interval90) và disclaimer trong OpenAPI.

### Nix + deploy

- `flake.nix`: input `nsac-data` pin **`c76d50d1df2aaffc07b41da8813519b5372c3dce`** — PHẢI bằng
  `git submodule status data`; bump submodule thì bump rev này trong CÙNG commit.
- `.#inferenceWheels` = **FOD chỉ chứa wheel** (`.whl`), `outputHash` **theo platform**:
  `x86_64-linux = sha256-f0wHlsmQQrOU2HAcPaiyAh4xcuzv3e/CxnPiN6Vd67M=`,
  `aarch64-linux = sha256-Z8rJBrfBCrcUWa64TxH3YcoHdLlGLrIAbIul8B9lziE=`. Bump khi `uv.lock` đổi:
  build với `lib.fakeHash` (local cho x86_64; box cho aarch64) rồi chép hash từ lỗi hash mismatch
  — xem `docs/fod-reproducibility.md`.
- `.#inference` = derivation thường: tạo venv từ wheelhouse (`uv pip install --no-index --find-links`),
  `autoPatchelfHook` sửa RPATH cho wheel manylinux (libstdc++/libgcc_s/libz), rồi ghi wrapper
  `bin/sky-inference` (SKY_DATA_ROOT/SKY_ML_SRC/PYTHONPATH baked) và symlink
  `share/inference-wheels` → FOD (nhờ đó gcroot `/nix/var/nix/gcroots/nsac-inference` bảo vệ cả FOD,
  không cần gcroot riêng cho wheelhouse).
- **FOD không thể chứa venv**: nix cấm output FOD tham chiếu store path, mà venv luôn tham chiếu
  interpreter (`pyvenv.cfg`, shebang `$out/bin/python`) — build FOD venv với hash đúng sẽ chết ở
  `error: fixed-output derivations must not reference store paths` (đã kiểm bằng probe). Vì vậy tách
  wheelhouse (FOD, cần mạng) ↔ venv+wrapper (derivation thường, không cần mạng).
- `scripts/deploy.sh` stage inference: build + pin gcroot → bootstrap-or-restart unit → `curl /health`.
  Health hỏng ⇒ in `journalctl -n 40` rồi **exit 1** (không rollback web/backend, không tag). Box/ssh
  không tới được hoặc unit không cài được ⇒ **fail-soft**: cảnh báo to, bỏ qua inference (và bỏ qua
  `nix-gc.sh`), web/backend vẫn deploy + tag.
- Unit: `ops/nsac-inference.service` → `/etc/systemd/system/nsac-inference.service`,
  `ExecStart=/home/ec2-user/nsac/result-inference/bin/sky-inference`, `User=ec2-user`, port 8100.

## Work Guidance

- Python **3.12** (`.python-version`) + uv. Không nâng `scikit-learn==1.9.1` / `lightgbm==4.7.0`:
  joblib/pickle cần đúng API lớp đã dùng lúc train; nâng = train lại rồi bump submodule.
- Không thêm dependency ngoài bộ trong `pyproject.toml` (không PyTorch, gRPC, broker, DB).
- Ngưỡng/trọng số y khoa không được bịa: service chỉ tái sử dụng ngưỡng của `sky_ml` (min/max tập train,
  phân vị OOF). Mọi con số hiển thị phải truy được về `provenance`.
- AI không quyết định một mình: service không tự hành động, chỉ trả dự báo/abstain; người xác nhận.
- Sửa `flake.nix`/`deploy.sh`/`nix-gc.sh`: giữ style hiện có, cập nhật cả 4 gcroot + unit bootstrap.
- Không sửa nội dung `data/` từ đây (submodule read-only).

## Verification

```bash
cd apps/ml-inference
uv sync --group dev                 # Python 3.12 + venv
uv run ruff check . && uv run ruff format --check .
uv run pytest -q                    # 26 test: registry/health/predict/abstain/batch/parity
uv run pytest -q -m cli_parity      # parity với sky-ml CLI thật (cây dữ liệu copy tạm)

# smoke thật (không qua nix)
SKY_DATA_ROOT=$PWD/../../data uv run python -m sky_inference    # 127.0.0.1:8100
curl -fsS http://127.0.0.1:8100/health
curl -fsS http://127.0.0.1:8100/v1/models/hr

# build artifact như trên box
nix build .#inference --out-link result-inference && ./result-inference/bin/sky-inference  # /health
```

Trên box (sau deploy): `systemctl status nsac-inference`, `curl -fsS http://127.0.0.1:8100/health`,
`sudo journalctl -u nsac-inference -n 40 --no-pager`, `readlink -f /nix/var/nix/gcroots/nsac-inference`.

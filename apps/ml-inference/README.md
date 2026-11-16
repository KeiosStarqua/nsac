# Sky ML inference — `apps/ml-inference`

FastAPI service phục vụ các mô hình đã train của pipeline `sky-ml` (submodule `data/`) qua HTTP
trên `127.0.0.1:8100`. Hợp đồng đầy đủ: xem `AGENTS.md` cùng thư mục.

```bash
cd apps/ml-inference
uv sync                      # venv dev (Python 3.12)
uv run uvicorn sky_inference.main:app --port 8100
curl -s localhost:8100/health | jq
```

`SKY_DATA_ROOT` mặc định là `<repo>/data`; trong nix (`.#inference`) wrapper đặt sẵn về store path
của input `nsac-data`. Dữ liệu là analog tổng hợp cho demo — không phải thiết bị y tế.

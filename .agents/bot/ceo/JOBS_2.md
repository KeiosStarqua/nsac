# JOBS_2 — CEO bot #2 job tracker (local)

File này là nơi CEO bot #2 ghi nhận và theo dõi các job được giao. Git-ignored? Không — commit nếu cần audit; mặc định giữ local.

## Jobs

| ID | Title | Status | Owner | Notes |
|---|---|---|---|---|
| J2-001 | Tạo JOBS_2.md quản lý job cho CEO bot #2 | done | ceo-bot-2 | File này |
| J2-002 | Trả lời về SQLite database hệ thống | done | ceo-bot-2 | Có — `backend/var/outbox.db` (bảng `outbox`), dùng cho queue báo cáo mặt đất trễ 20 phút |

## Notes

- DB duy nhất hiện tại: `backend/var/outbox.db` — adapter `backend/src/nsac/adapters/sqlite/outbox.py` (`Outbox`), delay `DELAY_MINUTES = 20`.
- Không có DB cho readings/deviations/readiness; dữ liệu demo sinh in-memory (generator 180 ngày) theo README.
- LangGraph checkpointer SQLite (Agent 2) chưa thấy trong code hiện tại — kiểm tra `backend/src/nsac/agent/` nếu cần.

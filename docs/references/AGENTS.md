# docs/references

## Purpose

Tài liệu tham chiếu bền vững cho HKT (NASA Space Apps 2026): danh mục chỉ số, nguồn NASA, ghi chú phạm vi — không phải code dự án.

## Ownership

Root `README.md` và root `AGENTS.md` (mục HKT) là hợp đồng sản phẩm; thư mục này chỉ lưu catalog tra cứu.

## Local Contracts

- Ngôn ngữ: tiếng Việt; giữ identifier kỹ thuật và tên metric tiếng Anh khi cần.
- ⭐ trong catalog: NASA đã/đang đo trên phi hành gia (ISS hoặc trước/sau bay).
- Không thêm ngưỡng y khoa hoặc trọng số readiness vào đây trừ khi có URL nguồn riêng (ngưỡng ship nằm trong code/UI sau 14/11).

## Work Guidance

Khi bổ sung metric hoặc hệ cơ quan: cập nhật file catalog tương ứng; nếu có dataset OSDR mới thì thêm vào bảng liên kết cuối file và vào `README.md` (mục nguồn dữ liệu) nếu dùng trong generator.

## Verification

Không có framework riêng; đối chiếu với README HKT và OSDR khi nghi ngờ.

## Child DOX Index

| File | Nội dung |
|---|---|
| `astronaut-health-metrics-by-system.md` | 17 hệ cơ quan + ghi chú liên tục vs định kỳ |
| `nasa-std-3001/` | NASA-STD-3001 Vol.1 Rev B (Crew Health): bản Markdown (Docling) cho agent đọc (PDF gốc chỉ giữ local, bị gitignore; tải lại từ `source_url` trong front matter); yêu cầu dạng `[V1 xxxx]`. Chưa index vào RAG trước 14/11 |

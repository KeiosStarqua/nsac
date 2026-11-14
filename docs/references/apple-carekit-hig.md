# Apple HIG — CareKit (digest)

- **Guide:** Apple Human Interface Guidelines — CareKit
- **URL gốc:** https://developer.apple.com/design/human-interface-guidelines/carekit
- **Phiên bản / changelog trên trang:** May 2, 2023 — Consolidated guidance into one page
- **Ngày truy cập:** 2026-11-14
- **Nguồn tác vụ:** session log `ses_e26402829ffebnRjmhXdCh1i0U` — đã fetch bản Markdown alternate (`…/carekit.md`), dùng làm nguồn chính cho digest này
- **Attribution:** Apple Inc. — Human Interface Guidelines. Bản gốc thuộc bản quyền Apple; tài liệu này là **tóm tắt/ghi nhớ thực dụng viết lại bằng lời riêng, KHÔNG phải bản sao nguyên văn**. Xem bản gốc tại URL trên và [Apple Terms of Use](https://www.apple.com/legal/internet-services/terms/site.html) / [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/).

## TL;DR / CareKit là gì

CareKit là framework Apple giúp xây app quản lý care plan (thuốc, vật lý trị liệu, mục tiêu wellness). CareKit 2.0 gồm hai dự án: **CareKit UI** (các view dựng sẵn, tuỳ biến được) và **CareKit Store** (schema database cho entities: patients, care plans, tasks, contacts, lưu trên thiết bị người dùng). Store và UI tự đồng bộ, nên care plan luôn cập nhật. CareKit chỉ hỗ trợ iOS và iPadOS; không có trên macOS, tvOS, visionOS, watchOS. Giá trị chính là các view chuẩn + privacy flow chuẩn của Apple.

## Các điểm bắt buộc / luật phải nhớ

### Kiến trúc & dữ liệu
- CareKit 2.0 = **CareKit UI** (views) + **CareKit Store** (database scheme: patients, care plans, tasks, contacts). Store ↔ UI sync tự động.
- Ba nhóm view: **Tasks** (present hành động: uống thuốc, tập, log triệu chứng), **Charts** (tiến trình điều trị), **Contacts** (giao tiếp với care team). Dùng đúng loại view cho đúng mục đích.
- View gồm header (title, symbol tuỳ chọn, disclosure indicator) + stack content subviews; layout do CareKit lo, không phá constraint.

### Privacy (bắt buộc — phần nặng nhất của guide)
- **Privacy policy URL bắt buộc** khi submit App Store; phải rõ ràng, dễ xem.
- **Permission chỉ khi cần và đúng context** (vd. xin quyền weight khi user log cân nặng, không xin lúc app vừa mở). Vì permission đổi được bất cứ lúc nào, hãy **re-ask mỗi lần cần truy cập**.
- **Standard permission screen + succinct purpose messages**: dùng màn hình hệ thống, viết vài câu ngắn gọn vì sao cần dữ liệu và user được lợi gì. **Không làm custom screen mô phỏng lại** standard permission screen.
- **Settings > Privacy là nơi duy nhất quản lý sharing**; không xây thêm màn hình trong app ảnh hưởng flow dữ liệu sức khoẻ.
- Motion data (CoreMotion) và camera/photos chỉ truy cập **khi user cho phép**; ResearchKit có **informed consent module** riêng cho nghiên cứu.
- Bảo vệ data dù user nhập tay hay app lấy từ device/system.

### Tasks (5 styles)
- Mỗi task: **Title** + **Schedule** bắt buộc; **Instructions** và **Group ID** tuỳ chọn.
- Năm styles: **simple** (một bước, button + checkmark), **instructions** (simple + text hướng dẫn), **log** (tap để log event, tự hiển thị timestamp), **checklist** (nhiều bước, list + checkmark), **grid** (nhiều bước compact, custom UI được).
- **Color-code được (medication vs exercise) nhưng không dùng color là tín hiệu duy nhất**.
- **Accuracy + simplicity**: dùng tên marketing của thuốc thay vì tên hoá học; bỏ từ thừa khi context đã rõ.
- Task phức tạp → thêm video/image minh hoạ.

### Charts (3 styles)
- **bar**, **scatter**, **line**. Mỗi chart cần title/subtitle + axis markers (vd. ngày trong tuần) + data set.
- **Short labels**; đơn vị thời gian phải rõ (giây/phút/ngày/tuần…); **distinct colors + đủ contrast**; legend khi màu không tự giải thích được.
- **Consolidate** data set lớn cho dễ đọc; **offset/restructure** khi chênh lệch giá trị quá lớn để mọi điểm đọc được; highlight trend/narratives (vd. correlation thuốc ↔ mức đau) để khuyến khích adherence.

### Contacts (2 styles)
- **simple** (glyph + tên + disclosure) và **detailed** (thông tin + nút call/message/email/map). Có thể color-code thành viên care team.

### Notifications
- **Sparing**: ít, coalesce nhiều item vào một notification; tránh làm user choáng với care plan dài.
- Notification **detail view** cho phép complete task inline mà không mở app.

### Symbols & branding
- Dùng **CareKit symbols** built-in; grid style có thể dùng custom SF Symbols liên quan health (vd. viên thuốc, người đi bộ).
- Custom symbol phải gần concept health/wellness; **không decorative / không logo corporate** làm symbol.
- Branding: **refined, unobtrusive** qua color/communication style; **không ads**; không làm user xao lãng care plan.

### Platform
- **iOS / iPadOS only**; không macOS, tvOS, visionOS, watchOS.

## Áp dụng cho Sky / HKT

Sky = astronaut health monitoring; web HUD trong `apps/web`; detection deterministic, con người xác nhận mọi hành động (confirm-first); AI chỉ giải thích/checklist/draft, không tự quyết. CareKit là app iOS native — nhưng triết lý và các luật dưới đây map trực tiếp:

- **Permission-in-context + system-screen-only** → Sky chỉ xin/truy cập dữ liệu sức khoẻ đúng lúc user mở đúng ngữ cảnh (vd. xin quyền sync biometrics khi user vào màn sleep), không xin hàng loạt lúc load HUD. Nếu sau này có bản iOS wrapper/CareKit companion, giữ đúng standard permission screen, **không** tự chế màn hình đồng ý health data.
- **Care-plan task views (5 styles)** → pattern cho checklist hành động trong HUD: `simple` ≈ nút "Xác nhận liều tập", `instructions` ≈ action kèm hướng dẫn, `log` ≈ log triệu chứng/báo cáo thủ công, `checklist` ≈ ground checklist nhiều bước (vd. pre-landing: compression garment, đứng có hỗ trợ), `grid` ≈ nhóm tác vụ tập luyện. Title + schedule luôn hiển thị; instructions tuỳ chọn.
- **Charts (bar/scatter/line)** → map sang trend charts trên HUD (HR/HRV/BP 2 tuần đầu theo Circulation 2026 ISS): title/subtitle + axis markers rõ đơn vị thời gian; short labels; distinct colors + contrast (xem a11y); legend khi cần; consolidate dữ liệu dài ngày; highlight trend (medication ↔ pain/adherence) để khuyến khích tuân thủ.
- **Contacts** → "Call ground / flight surgeon" action: simple view = tên + vai trò; detailed = nút call/message/email/map. Tham khảo pattern này cho phần liên lạc trong HUD.
- **Privacy-first flows** → không có consent = không có dữ liệu. Health data của phi hành gia cực nhạy: privacy policy phải có trước khi ship; mọi sharing chỉ qua Settings > Privacy (native) hoặc cơ chế tường minh tương đương (web); không màn hình giả-mạo permission.
- **Notification sparing** → HUD chỉ cảnh báo khi triage vàng/đỏ; coalesce nhiều deviation vào một cảnh báo; notification detail cho phép confirm inline (confirm-first) thay vì mở app.
- **Symbols/branding** → icon/symbol gần concept health; branding tinh tế, **không ads, không logo corporate** trong care flow. SF Symbols chỉ dùng khi ship trên Apple platform.
- **ResearchKit informed consent** → nếu demo dùng dữ liệu nghiên cứu (OSDR/Inspiration4 hold-out), consent form phải tường minh, không mặc định đồng ý.
- **Confirm-first + AI-explains** → CareKit không có AI tự quyết; Sky giữ nguyên: deterministic detection → một action → `interrupt()` chờ xác nhận. AI chỉ soạn rationale/checklist, không bao giờ auto-execute.

## Những gì KHÔNG áp dụng cho Sky

- **CareKit là iOS/iPadOS native** — Sky là web (TanStack Start, `apps/web`); không import CareKit UI/Store. Chỉ mượn pattern (task styles, chart rules, privacy flow), không dùng code.
- CareKit Store sync, CareKit symbols, SF Symbols: chỉ liên quan nếu sau này có companion app iOS — hiện out of scope HKT.
- Notification detail view / badging: HUD web không có APNs; tương đương = in-app panel confirm.

## Câu hỏi còn mở / việc cần quyết

- Sky có cần bản iOS companion (CareKit/HealthKit) cho HKT không, hay web-only đủ cho demo 60s? (chưa quyết — ảnh hưởng việc có implement standard permission flow thật hay chỉ mock)
- Nếu có iOS wrapper: privacy policy URL đặt ở đâu, ai host?
- Checklist pre-landing (compression garment…) map sang `checklist` hay `grid` style — quyết khi làm UI tasks.
- Notification coalescing cho nhiều yellow/red deviations cùng lúc — gộp một cảnh báo hay theo từng hệ cơ quan?

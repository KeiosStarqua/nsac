# Apple HIG — HealthKit (digest)

- **Guide:** Apple Human Interface Guidelines — HealthKit
- **URL gốc:** https://developer.apple.com/design/human-interface-guidelines/healthkit
- **Phiên bản / changelog trên trang:** n/a (trang không ghi ngày changelog)
- **Ngày truy cập:** 2026-11-14
- **Nguồn tác vụ:** session log `ses_e26402829ffebnRjmhXdCh1i0U` — đã fetch bản Markdown alternate (`…/healthkit.md`), dùng làm nguồn chính cho digest này
- **Attribution:** Apple Inc. — Human Interface Guidelines. Bản gốc thuộc bản quyền Apple; tài liệu này là **tóm tắt/ghi nhớ thực dụng viết lại bằng lời riêng, KHÔNG phải bản sao nguyên văn**. Xem bản gốc tại URL trên và [Apple Terms of Use](https://www.apple.com/legal/internet-services/terms/site.html) / [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/).

## TL;DR / HealthKit là gì

HealthKit là kho dữ liệu sức khoẻ và thể chất trung tâm trên iOS, iPadOS và watchOS. App được phép xin quyền đọc/ghi dữ liệu sức khoẻ — nhưng chỉ khi app **thật sự có health/fitness functionality**. Nếu app không có chức năng sức khoẻ, **không được xin quyền truy cập dữ liệu sức khoẻ riêng tư**. HealthKit đi kèm hai "vật phẩm" có luật dùng nghiêm ngặt: **Activity rings** (Move/Exercise/Stand) và **Apple Health icon** — cả hai chỉ để hiển thị/chỉ dẫn tương thích, không phải tài nguyên thiết kế tự do. HealthKit **không hỗ trợ macOS, tvOS, visionOS**.

## Các điểm bắt buộc / luật phải nhớ

### Privacy (giống CareKit — bắt buộc)
- **Privacy policy URL bắt buộc** khi submit App Store; rõ ràng, dễ xem.
- **Permission chỉ khi cần và đúng context** (vd. xin quyền weight khi user log cân nặng); **re-ask mỗi lần cần truy cập** vì permission thay đổi được.
- **Standard permission screen + succinct purpose messages**; **không làm custom screen mô phỏng lại** màn hình hệ thống.
- **Settings > Privacy là nơi duy nhất quản lý sharing**; không xây màn hình riêng ảnh hưởng flow dữ liệu sức khoẻ.
- Sau khi được cấp quyền, giữ trust bằng cách minh bạch cách app dùng dữ liệu.
- Không có health functionality → không request.

### Activity rings (luật rất chặt)
- **Chỉ cho Move, Exercise, Stand** — đúng ba vòng, đúng ý nghĩa; không replicate/modify cho mục đích khác, không vòng ring-like nào khác hiển thị cùng loại dữ liệu này.
- **Single person** — không biểu diễn dữ liệu nhiều người; phải rõ ring của ai (label, photo, avatar).
- **Không ornamentation** — rings cung cấp thông tin, không embellish UI, không đặt trong labels/background graphics.
- **Không branding** — không dùng trong app icon, marketing materials; chỉ để hiển thị progress Activity.
- **Giữ nguyên màu/appearance** — không filter, không đổi màu, không đổi opacity; thiết kế surrounding interface để hoà với ring (vd. bao trong circle, scale đúng tỷ lệ).
- **Margin ngoài ≥ khoảng cách giữa các ring**; không crop/obstruct/encroach; muốn đặt trong circle thì chỉnh corner radius của enclosing view, không dùng circular mask.
- **Differentiate** ring-like elements khác bằng padding/lines/labels/color/scale.
- **Không lặp system notification** Move/Exercise/Stand; **không show Activity ring trong notification của app** — được nhắc Activity progress nhưng phải unique to app, không replicate system info.
- Ring chỉ để hiển thị — app không tự chế ring giống nó.

### Apple Health icon (luật rất chặt)
- **Chỉ dùng Apple-provided icon** — không tự thiết kế, không mimic; tải từ Apple Design Resources.
- **Đặt tên *Apple Health* cạnh icon** — nhắc user icon đại diện Health app.
- **Không nhỏ hơn** các app icon sức khoẻ khác trong cùng view.
- **Không làm button** — chỉ chỉ dẫn tương thích với Health app.
- **Không alter** — không mask đổi corner radius/circle, không border, color overlay, gradient, shadow, embellishment.
- **Clear space tối thiểu = 1/10 chiều cao icon**; không composite lên graphic khác.
- **Không đặt trong text**, không thay thế cho các chữ *Health*, *Apple Health*, *HealthKit*.
- **Không hiển thị Health app screenshots** — ảnh Apple có copyright, không được dùng trong app/marketing.

### Editorial guidelines (copy/UI text)
- Gọi app là ***Apple Health*** hoặc ***the Apple Health app*** — không gọi *HealthKit* với user. *HealthKit* là thuật ngữ developer-facing cho framework.
- Viết đúng capitalization: *Apple Health* (hai từ, A và H hoa). ALL-CAPS chỉ khi style typographic bắt buộc (app viết hoa toàn bộ text).
- Dùng **system-provided translation** của *Health* theo ngôn ngữ thiết bị user để tránh nhầm lẫn.
- Giải thích tương tác: "works with the Apple Health app", "uses data from the Apple Health app". Xem style "How your app works with the Apple Health app".

### Platform
- **iOS / iPadOS / watchOS only**; không macOS, tvOS, visionOS.

## Áp dụng cho Sky / HKT

Sky = astronaut health monitoring; web HUD trong `apps/web`; deterministic detection + confirm-first; AI chỉ giải thích. HealthKit cũng là iOS-only API — cùng kết luận như CareKit: mượn triết lý và luật, không dùng code:

- **Privacy contract** → Sky không "HealthKit" thật, nhưng cùng chuẩn: không có health functionality thì không xin dữ liệu; xin đúng context; UI phải nói rõ dùng dữ liệu gì để làm gì; user quản lý consent tập trung, không màn hình giả. Privacy policy ship cùng HKT submission.
- **No health data claims without consent** → HUD không được render "đây là dữ liệu từ Apple Health" hay tương đương nếu chưa có consent tường minh; mọi số liệu synthetic/OSDR phải ghi rõ nguồn (SIMULATED / OSDR) — khớp hard rule "mọi ngưỡng/claim phải có nguồn".
- **Activity rings rules** → nếu HUD hiển thị tiến độ liều tập (Move/Exercise/Stand-like): không tự chế vòng ring giống Apple Activity cho cùng dữ liệu; không branding bằng ring trong logo/marketing; ring chỉ cho single astronaut + label tên rõ ràng; không nhái appearance/màu. Tốt hơn: dùng progress bar/arc riêng, tránh xung đột trademark/design language.
- **Apple Health icon rules** → nếu submission/demo nhắc Apple Health (vd. "tích hợp tương lai"): chỉ Apple-provided icon, cạnh chữ *Apple Health*, không làm button, không alter, clear space ≥ 1/10 height, không screenshot Health app.
- **Editorial** → mọi copy trong HUD/submission: "Apple Health" / "the Apple Health app", không "HealthKit"; đúng capitalization; translation theo thiết bị.
- **Platform limits (iOS/iPadOS/watchOS)** → Sky là web; mọi điểm HealthKit ở đây là định hướng nếu ship companion app, không phải ràng buộc hiện tại.
- **Confirm-first** → HealthKit không có khái niệm confirm hành động; Sky bổ sung: mọi action từ deviation (tim mạch, liều tập) phải qua `interrupt()` + xác nhận, AI chỉ soạn rationale.

## Những gì KHÔNG áp dụng cho Sky

- **HealthKit là iOS/iPadOS/watchOS native framework** — Sky là web; không gọi `HKHealthStore`, không Activity ring element (`HKActivityRingView`), không Apple Health icon trong UI hiện tại.
- Activity rings & Apple Health icon: chỉ hiển thị thông tin/tương thích trên Apple platform; Sky không có ngữ cảnh dùng hợp lệ ngay bây giờ — chỉ áp dụng nếu có iOS companion sau HKT.
- Editorial rules chỉ áp dụng khi copy nhắc trực tiếp Apple Health; nội bộ HKT (README, slide) nên tránh nhắc nếu không cần.

## Câu hỏi còn mở / việc cần quyết

- HKT có cần "works with the Apple Health app" story cho demo (vd. slide roadmap companion iOS) hay tránh nhắc Apple hoàn toàn?
- Nếu làm iOS companion sau 14/11: ai chịu trách nhiệm privacy policy + App Store submission (đòi hỏi Apple Developer account)?
- Readiness score 0–100 của Sky có nên hiển thị dạng ring-like không? → Không, dùng arc/bar riêng để tránh vi phạm ring rules nếu/khi ship iOS.

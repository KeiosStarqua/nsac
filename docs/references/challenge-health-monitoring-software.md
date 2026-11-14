# Challenge: Create Health Monitoring Software for Astronauts on Space Missions

**Kiểm tra lần cuối:** 2026-11-02 (đọc bằng Playwright; curl/web_fetch lỗi chứng chỉ TLS)
**Nguồn:** https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=details
**Tab Resources:** https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=resources

Ghi chú nghiên cứu, không phải thiết kế. Không chứa code, prompt, mockup hay công thức (xem luật "không code trước 14/11/2026 09:00" ở root `AGENTS.md`).

## Thông tin chung

| Mục | Giá trị |
|---|---|
| Sự kiện | 2026 NASA Space Apps Challenge, 14–15/11/2026 |
| Độ khó | Intermediate |
| Chủ đề | Human Exploration, Software, Space Exploration |
| Banner trang | "Do not begin work on your projects until the hackathon begins" |
| Tab Resources | Trống; ghi "available on Friday, November 13" (2026-11-13) |
| Tab Teams | https://www.spaceappschallenge.org/2026/find-a-team/ |
| FAQ | https://www.spaceappschallenge.org/resources/participant-faqs/ |
| Guides | https://www.spaceappschallenge.org/resources/ |

Bối cảnh chung của NASA cho năm nay (trọng tâm Moon / Mars / vũ trụ, nhắc "monitoring physiological and behavioral health indicators" cho chuyến đi dài): https://science.nasa.gov/universe/nasa-welcomes-all-ages-experience-levels-for-space-apps-challenge/ (kiểm tra 2026-11-02).

## Đề bài (tóm tắt)

- Chuyến bay dài ngày gây: bức xạ, cô lập và giam hãm, trọng lực thay đổi, môi trường kín khắc nghiệt. Hệ quả: thay đổi miễn dịch, mất xương, biến cố tim mạch, vấn đề hành vi.
- Phi hành gia tự chịu phần lớn trách nhiệm phát hiện các thay đổi này trên chính mình.
- **Nhiệm vụ:** làm phần mềm thu thập chỉ số sức khỏe, giúp phi hành gia **đánh giá và hành động** theo tình trạng sức khỏe.
- Bối cảnh nêu trong đề: Artemis vừa bay vòng Mặt Trăng có người; NASA và các bên khác có kế hoạch đưa người lên sao Hỏa.
- Năm hazard của NASA Human Research Program: bức xạ, cô lập/giam hãm, khoảng cách tới Trái Đất, trường trọng lực, môi trường kín khắc nghiệt.
- Vấn đề sức khỏe liên quan: miễn dịch, mất mật độ xương, tim mạch, dinh dưỡng, sức khỏe hành vi.
- Chỉ số gợi ý trong đề: huyết áp, nhịp tim, đường huyết, thân nhiệt, giờ ngủ mỗi ngày, tâm trạng.

## Mục tiêu (objectives)

1. Làm **công cụ trực quan** giúp phi hành gia tự đánh giá sức khỏe và **hướng dẫn điều trị / cải thiện**.
2. Đầu vào tự do: bàn phím, chuột, ảnh camera... Mọi dữ liệu miễn là đại diện một chỉ số sức khỏe (ví dụ đường huyết mg/dL, ảnh siêu âm).
3. Dùng tài nguyên NASA HRP và các cơ quan vũ trụ khác để chọn chỉ số.
4. Câu hỏi đề muốn đội trả lời:
   - Đo được gì trong không gian?
   - Vì sao cần xét nghiệm/đo đó?
   - Hazard ảnh hưởng chỉ số thế nào?
   - Khi nào cần báo phi hành đoàn hoặc bác sĩ bay (flight surgeon) dưới đất?
   - Hành động nào phòng được tình trạng nguy kịch?
5. Thiết kế UI quan trọng: trình bày số liệu và chẩn đoán rõ ràng; khuyến khích animation, tương tác. Ví dụ trong đề: hình người, từng bộ phận bấm được, hiện chức năng và tình trạng.

## Gợi ý không bắt buộc

- Nhiều môi trường: tàu vũ trụ, trạm, rover, căn cứ trên hành tinh/mặt trăng khác.
- Nhắc phi hành gia đo hoặc làm việc định kỳ như một phần lịch trình nhiệm vụ.
- Gamification để tăng gắn kết với việc chăm sóc sức khỏe.
- Biểu đồ động theo thời gian.
- Mã màu để đọc nhanh trạng thái.
- Đừng giả định phi hành gia biết cách tự đánh giá: cần hướng dẫn và giải thích đơn giản về phép đo, chỉ số, rủi ro.

## Đối chiếu với kế hoạch HKT hiện tại

Khớp: tim mạch + xương/cơ, triage xanh/vàng/đỏ (mã màu), biểu đồ theo thời gian, hành động tiếp theo có giải thích, báo cáo cho mặt đất (flight surgeon), readiness (gamification nhẹ).

Khoảng trống so với đề (cần quyết định sau 14/11 09:00):

| Đề nhấn mạnh | Kế hoạch hiện tại |
|---|---|
| UI trực quan, tương tác (ví dụ hình người bấm được) | Timeline, gauge, cards; chưa có body map |
| Giải thích cho người không chuyên: đo gì, vì sao, rủi ro | Hướng hành động; thiếu lớp "vì sao đo chỉ số này" |
| Giấc ngủ, tâm trạng, thân nhiệt, đường huyết | Hành vi/nhận thức chỉ là interface; giấc ngủ chỉ xuất hiện qua chuỗi DONKI |
| Đầu vào thủ công / camera | Dữ liệu synthetic; chưa có nhập tay |
| Nhắc đo theo lịch nhiệm vụ | Chưa nêu |
| Nhiều môi trường (station, rover, căn cứ) | Chỉ hành trình Mars |

## Việc theo dõi

- **14/11/2026:** Đã tải tab Resources vào `docs/references/spaceapps-resources-2026/` (NASA HRP hazards/risks/ongoing research, ASC-CSA articles). Resources ban đầu trống, công bố 13/11/2026.
- Đọc Resources, FAQ, và Participant Guides ngay khi có; ghi lại dataset mới vào `README.md` (mục nguồn dữ liệu) nếu dùng.
- Trước 14/11 09:00 chỉ làm nghiên cứu, cài tool, tải model/dataset công khai; không code dự án.

import type { Copy } from "./types";

export const vi: Copy = {
  meta: {
    title: "Bác sĩ tạm trên tàu | NASA Space Apps 2026 HCMC",
    description:
      "Trợ lý sức khỏe offline cho phi hành gia: baseline riêng từng người, một hành động phục hồi, mức sẵn sàng hạ cánh Sao Hỏa.",
  },
  nav: {
    concept: "Ý tưởng",
    demo: "Demo",
    modules: "Module",
    story: "Câu chuyện",
    trust: "An toàn",
    sources: "Nguồn",
    language: "Ngôn ngữ",
    skip: "Chuyển đến nội dung",
  },
  hero: {
    eyebrow: "NASA Space Apps 2026 · TP. Hồ Chí Minh",
    title: "Một bác sĩ trong khoang tàu khi Trái Đất cách 20 phút.",
    lead: "Trợ lý offline học baseline riêng của từng phi hành gia, phát hiện lệch sớm và nói việc cần làm tiếp: một hành động phục hồi, một lần xác nhận, một báo cáo gửi về.",
    challenge: "Thử thách: Create Health Monitoring Software for Astronauts on Space Missions",
    primaryCta: "Thử demo",
    secondaryCta: "Cách hoạt động",
    badges: ["Chạy hoàn toàn offline", "Phi hành gia xác nhận mọi hành động", "Mã nguồn mở, Apache-2.0"],
  },
  difference: {
    title: "Không phải một dashboard sức khỏe nữa",
    lead: "Dashboard cho bác sĩ thấy chỗ nào sai. Sản phẩm này dành cho phi hành gia không có bác sĩ bên cạnh.",
    columns: { label: "", dashboard: "Dashboard thông thường", ours: "Bác sĩ tạm" },
    rows: [
      { label: "Ai dùng", dashboard: "Bác sĩ bay trên mặt đất", ours: "Phi hành gia, ngay trên tàu" },
      { label: "Mạng", dashboard: "Cần đường truyền sống", ours: "Rút dây mạng vẫn chạy" },
      { label: "So với", dashboard: "Khoảng giá trị quần thể", ours: "Baseline của chính bạn" },
      { label: "Kết quả", dashboard: "Biểu đồ chỗ lệch", ours: "Một việc làm tiếp" },
    ],
  },
  pipeline: {
    title: "Từ tín hiệu đến hành động",
    lead: "Phát hiện là mã deterministic. Mô hình ngôn ngữ chỉ giải thích và soạn nháp. Phi hành gia quyết định.",
    steps: [
      {
        title: "Phát hiện",
        body: "So từng chỉ số với baseline của chính phi hành gia: median và độ phân tán, xu hướng, điểm đổi.",
        tag: "Deterministic",
      },
      {
        title: "Liên kết",
        body: "Nối tín hiệu giữa các hệ: bão Mặt Trời, rồi mất ngủ, rồi bỏ tập, rồi tim và chân giảm sẵn sàng.",
        tag: "Thời tiết vũ trụ, tim, xương và cơ",
      },
      {
        title: "Đề xuất",
        body: "Chọn một hành động trong ISS Medical Checklist và giải thích bằng lời dễ hiểu.",
        tag: "AI cục bộ giải thích",
      },
      {
        title: "Xác nhận",
        body: "Không có gì chạy cho đến khi phi hành gia bấm Confirm.",
        tag: "Có người duyệt",
      },
      {
        title: "Báo cáo",
        body: "File PDF cho đội mặt đất được xếp hàng và gửi sau độ trễ đường truyền.",
        tag: "Trễ 20 phút",
      },
    ],
  },
  demo: {
    title: "Mức sẵn sàng hạ cánh Sao Hỏa",
    lead: "Ngày 170, còn hai đến ba tuần trước khi hạ cánh. Bấm lần lượt để xem câu chuyện.",
    gravity: "Câu hỏi: phi hành đoàn có đứng được ở trọng lực Sao Hỏa, khoảng 0,38 so với Trái Đất?",
    gravitySource: "Bảng số liệu Sao Hỏa của NASA",
    simulated: "Dữ liệu mô phỏng",
    offline: "Offline",
    scoreLabel: "Sẵn sàng",
    scoreRange: "0 đến 100",
    severity: { yellow: "Vàng", green: "Xanh" },
    headline: {
      alert: "Điểm sẵn sàng thấp hơn baseline của phi hành gia",
      confirmed: "Đã xác nhận hành động. Báo cáo mặt đất đang chờ gửi.",
      fastForwarded: "Hai tuần sau: điểm sẵn sàng đã tăng lại",
    },
    eventsTitle: "Agent đã liên kết gì",
    events: [
      { when: "Ngày 156", text: "DONKI báo có bão Mặt Trời" },
      { when: "Ngày 156 đến 170", text: "Hai tuần bỏ tập" },
      { when: "Ngày 170", text: "Mức sẵn sàng của tim và chân giảm dưới baseline" },
    ],
    afterEvents: [
      { when: "Ngày 170", text: "Phi hành gia xác nhận buổi tập phục hồi" },
      { when: "Ngày 184", text: "Hoàn thành các buổi phục hồi, điểm sẵn sàng tăng lại" },
    ],
    recommendationTitle: "Một hành động được đề xuất",
    action: "Hoàn thành buổi tập phục hồi hôm nay",
    rationale:
      "Đã bỏ tập 14 ngày sau bão Mặt Trời. Mức sẵn sàng của tim và chân thấp hơn baseline của chính phi hành gia.",
    needsConfirm: "Cần bạn xác nhận",
    confirmedLabel: "Đã xác nhận",
    confirm: "Xác nhận",
    fastForward: "Tua nhanh 2 tuần",
    reset: "Làm lại",
    linkTitle: "Đường truyền về Trái Đất",
    link: {
      idle: "Chưa có báo cáo",
      queued: "Báo cáo đang chờ, mô phỏng trễ 20 phút",
      delivered: "Báo cáo đã đến mặt đất",
    },
    disclaimer: "Nội dung do AI tạo, không thay thế bác sĩ.",
    note: "Giá trị minh họa. Ứng dụng hiển thị công thức và nguồn cho từng trọng số.",
    dayLabel: "Ngày",
    running: "Đang tua nhanh tới ngày",
    error: "Luồng mô phỏng đã dừng. Bấm Làm lại rồi thử lại.",
    pageEyebrow: "Demo tương tác",
  },
  demoTeaser: {
    title: "Xem tận mắt",
    lead: "Ngày 170, hai tuần bỏ tập. Xem agent nối các tín hiệu, rồi tự xác nhận một hành động.",
    cta: "Mở demo tương tác",
    snapshotLabel: "Ảnh chụp từ máy chủ",
    unavailable: "Không tải được ảnh chụp. Demo vẫn chạy bình thường.",
  },
  storyTeaser: {
    title: "Câu chuyện: Sky, người nhìn cùng bạn",
    lead: "Bốn người trên tàu, một ổ bệnh trong khu vườn, và một hành động mà chỉ người chỉ huy mới được xác nhận.",
    cta: "Đọc câu chuyện",
  },
  story: {
    pageTitle: "Câu chuyện | Bác sĩ tạm trên tàu",
    pageDescription: "Sky, truyện hư cấu cho thấy bác sĩ tạm phát hiện, nối tín hiệu và xin phi hành đoàn xác nhận một hành động.",
    eyebrow: "Truyện hư cấu",
    tocTitle: "Các chương",
    languageNote: "Truyện hư cấu: tên người, tên tàu và diễn biến đều là tưởng tượng.",
    unavailable: "Không tải được câu chuyện.",
    next: {
      title: "Giờ thử bản thật",
      body: "Truyện là hư cấu. Demo chạy cùng vòng lặp trên dữ liệu mô phỏng: phát hiện, đề xuất, xác nhận, báo cáo.",
      cta: "Mở demo tương tác",
    },
  },
  modules: {
    title: "Module",
    lead: "Ba module đang chạy. Ba module là giao diện trên sơ đồ, sẵn sàng cắm vào.",
    workingLabel: "Đang chạy",
    stubLabel: "Chỉ giao diện",
    working: [
      {
        name: "Tim mạch",
        body: "Nhịp tim, HRV, huyết áp và xu hướng thể tích thất trái, thể tích nhát bóp trong hai tuần đầu trên ISS.",
        source: "circulation",
      },
      {
        name: "Xương và cơ",
        body: "Theo dõi mức sẵn sàng của chân và kê liều tập để phục hồi.",
      },
      {
        name: "Thời tiết vũ trụ",
        body: "Sự kiện bão Mặt Trời từ DONKI, làm tín hiệu đầu vào cho agent.",
        source: "donki",
      },
    ],
    stubs: [
      { name: "Miễn dịch và máu", body: "Điểm cắm cho công thức máu và chỉ số viêm." },
      { name: "Hành vi và nhận thức", body: "Điểm cắm cho giấc ngủ, tâm trạng và hiệu suất." },
      { name: "Môi trường", body: "Điểm cắm cho không khí cabin, bức xạ và tiếng ồn." },
    ],
    landingTitle: "Chế độ hạ cánh",
    landingBody:
      "Vài giờ trước khi hạ cánh, hướng dẫn chuyển từ tập luyện sang các bước an toàn, ví dụ đứng có hỗ trợ.",
    plannedLabel: "Dự kiến",
  },
  trust: {
    title: "Xây dựng để đáng tin",
    lead: "Các quy tắc cả dự án tuân theo.",
    items: [
      { title: "Offline trước tiên", body: "Chạy trên một laptop. Rút dây mạng, mọi thứ vẫn như cũ." },
      {
        title: "AI không tự quyết",
        body: "Phát hiện là deterministic. Mô hình giải thích và soạn nháp. Phi hành gia xác nhận.",
      },
      {
        title: "Mỗi con số có nguồn",
        body: "Ngưỡng và trọng số có URL trong mã và trên màn hình.",
      },
      {
        title: "Không dữ liệu cá nhân",
        body: "Dữ liệu phi hành đoàn là synthetic, sinh theo khoảng giá trị công bố trong các nghiên cứu NASA OSDR.",
      },
    ],
    disclaimer: "Nội dung do AI tạo, không thay thế bác sĩ.",
  },
  earth: {
    title: "Cùng một vấn đề trên Trái Đất, tại TP. Hồ Chí Minh",
    lead: "Câu chuyện minh họa cho phần pitch.",
    body: "NASA dùng nằm giường dài ngày để nghiên cứu thay đổi cơ thể khi bay vào vũ trụ. Bệnh nhân nằm viện hai tuần sau phẫu thuật gặp một dạng mất thể lực liên quan. Cách làm áp dụng được: so với baseline của chính người đó, rồi kê một liều tập.",
    sourceLabel: "NASA: nằm giường dài ngày như mô hình bay vũ trụ",
  },
  sources: {
    title: "Nguồn",
    lead: "Các link của dự án được mở ngày 2026-10-18. Link không có ngày là link chặn kiểm tra tự động.",
    checkedLabel: "đã kiểm tra",
    items: {
      osd569: { label: "OSD-569", note: "Công thức máu Inspiration4" },
      osd575: { label: "OSD-575", note: "Chuyển hóa và cytokine" },
      osdrApi: { label: "API dữ liệu OSDR", note: "Truy cập các nghiên cứu bằng chương trình" },
      donki: { label: "DONKI", note: "Sự kiện thời tiết vũ trụ" },
      issChecklist: { label: "ISS Medical Checklist (bản sao)", note: "Nguồn của các hành động đề xuất" },
      circulation: { label: "Circulation 2026", note: "Thay đổi ở tim trong hai tuần đầu trên ISS" },
      marsGravity: { label: "Bảng số liệu Sao Hỏa của NASA", note: "Trọng lực bề mặt, 0,38 so với Trái Đất" },
      bedRest: { label: "NASA: nằm giường như mô hình tương tự", note: "Vì sao dùng nằm giường để nghiên cứu bay vũ trụ" },
    },
  },
  footer: {
    line: "Làm cho NASA Space Apps Challenge 2026, TP. Hồ Chí Minh. Không phải sản phẩm chính thức của NASA.",
    license: "Apache-2.0",
    synthetic: "Giá trị demo là mô phỏng và dữ liệu phi hành đoàn là synthetic.",
  },
};

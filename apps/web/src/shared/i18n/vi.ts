import type { Copy } from "./types";

export const vi: Copy = {
  meta: {
    title: "Sky, trợ lý lâm sàng cho phi hành gia | NASA Space Apps 2026 HCMC",
    description:
      "Sky là trợ lý lâm sàng offline cho các chuyến bay dài ngày: thu thập dữ liệu sức khỏe phi hành đoàn, cảnh báo phi hành gia và bác sĩ bay, đề xuất một hành động.",
  },
  nav: {
    living: "SKY Trực tiếp",
    features: "Tính năng",
    hazards: "Rủi ro",
    data: "Dữ liệu",
    demo: "Demo",
    concept: "Khái niệm",
    story: "Câu chuyện",
    trust: "An toàn",
    sources: "Nguồn",
    language: "Ngôn ngữ",
    skip: "Chuyển đến nội dung",
  },
  hero: {
    eyebrow: "NASA Space Apps 2026 · TP. Hồ Chí Minh",
    title: "Gặp Sky, trợ lý lâm sàng đi cùng phi hành đoàn.",
    lead: "Trên chuyến bay tới Sao Hỏa không có tiếp tế và Trái Đất ở rất xa. Sky đóng vai điều dưỡng lâm sàng: thu thập dữ liệu y khoa quan trọng, phân tích, rồi đưa ra khuyến nghị và cảnh báo cho phi hành gia và bác sĩ bay trước khi vấn đề thành sự cố y tế.",
    challenge: "Thử thách: Create Health Monitoring Software for Astronauts on Space Missions",
    primaryCta: "Thử demo",
    secondaryCta: "Xem tính năng",
    badges: ["Chạy hoàn toàn offline", "Con người xác nhận mọi hành động", "Mã nguồn mở, Apache-2.0"],
  },
  features: {
    title: "Hai trợ lý, một phi hành đoàn",
    lead: "Sky phục vụ phi hành gia và bác sĩ bay từ cùng một nguồn dữ liệu.",
    exampleLabel: "Ví dụ",
    items: [
      {
        audience: "Cho phi hành gia",
        name: "Trợ lý sức khỏe cá nhân",
        body: "Sky phân tích các hoạt động và môi trường gắn với từng nhiệm vụ, rồi đưa ra gợi ý riêng giúp phi hành gia làm việc tốt nhất. Nếu một phi hành gia gặp sự cố y tế, Sky báo cho mọi thành viên để cả đoàn cùng ứng phó.",
        example:
          "Ngày mai phi hành gia phải làm việc nặng trên bề mặt thiên thể. Sky khuyên dùng một loại thực phẩm bổ sung và ngủ đủ để chuẩn bị.",
      },
      {
        audience: "Cho bác sĩ bay",
        name: "Trợ lý lâm sàng",
        body: "Sky liên tục thu thập dữ liệu y khoa của cả đoàn và phân tích để hỗ trợ bác sĩ bay chẩn đoán và đề xuất điều trị. Sky đo nguy cơ bệnh truyền nhiễm trong đoàn, cho từng người và cho cả đoàn.",
        example:
          "Nhật ký y tế của một phi hành gia có triệu chứng cúm, nên nguy cơ lan ra cả đoàn tăng. Sky cảnh báo bác sĩ bay và đề xuất cách ly. Sky gợi ý điều trị cho người có nguy cơ, và biện pháp phòng ngừa cùng triệu chứng cần để ý cho những người còn lại.",
      },
    ],
  },
  hazards: {
    title: "Năm rủi ro Sky theo dõi",
    lead: "NASA chia rủi ro của chuyến đi Sao Hỏa thành năm nhóm. Với mỗi nhóm, Sky theo dõi các tín hiệu quan trọng và so với baseline trước chuyến bay của chính phi hành gia.",
    risksLabel: "Rủi ro",
    measuredLabel: "Đo bằng",
    items: [
      {
        name: "Bức xạ vũ trụ",
        body: "Tổn thương tim mạch và nội mạc, và suy giảm sinh thần kinh.",
        risks: [
          "Cứng động mạch và lão hóa mạch sớm",
          "Dày nội mạc",
          "Rối loạn nhịp và dẫn truyền",
          "Tổn thương cơ tim",
          "Không dung nạp tư thế đứng sau EVA và hạ cánh",
          "Trí nhớ không gian và trí nhớ làm việc",
          "Áp lực nội sọ và stress thần kinh-thị giác",
          "Rối loạn nhịp thức-ngủ",
        ],
        measured: [
          "Vận tốc sóng mạch",
          "Siêu âm động mạch cảnh",
          "ECG Holter hoặc miếng dán thông minh",
          "Troponin, hs-CRP, IL-6 tại chỗ",
          "Huyết áp và nhịp tim liên tục",
          "Bộ test nhận thức NASA",
          "Chụp cắt lớp quang học",
          "fNIRS",
          "Actigraphy đeo cổ tay",
        ],
      },
      {
        name: "Thay đổi trường trọng lực",
        body: "Nhiều tháng không trọng lực trên đường đi, khoảng ⅜ trọng lực Trái Đất trên Sao Hỏa, rồi thích nghi lại với trọng lực Trái Đất.",
        risks: [
          "Dịch chuyển lên đầu và hội chứng thần kinh-mắt do bay vũ trụ",
          "Mất xương",
          "Teo cơ và giảm sức mạnh",
          "Suy giảm thể trạng tim mạch",
          "Say vận động vũ trụ và mất thăng bằng",
        ],
        measured: [
          "Chụp cắt lớp quang học",
          "DXA hoặc pQCT và chỉ dấu luân chuyển xương",
          "Theo dõi tải và công suất ARED",
          "Siêu âm và siêu âm tim",
          "Holter và máy đo huyết áp",
          "Test hành vi thần kinh và đánh giá dáng đi",
        ],
      },
      {
        name: "Cô lập và giam hãm",
        body: "Một nhóm nhỏ, xa nhà, trong thời gian dài.",
        risks: ["Thiếu ngủ", "Lệch nhịp sinh học", "Quá tải công việc"],
        measured: [
          "Actigraphy cổ tay và nhật ký giấc ngủ",
          "Test cảnh giác tâm vận động",
          "Nhịp melatonin và cortisol",
          "Thân nhiệt lõi",
          "NASA Task Load Index",
          "Nhật ký tâm trạng và phân tích stress giọng nói",
        ],
      },
      {
        name: "Môi trường kín và khắc nghiệt",
        body: "Hệ sinh thái trong tàu ảnh hưởng đến vi sinh vật, hệ miễn dịch và nội tiết của phi hành đoàn.",
        risks: [
          "Hệ vi sinh ruột, da và niêm mạc thay đổi",
          "Rối loạn miễn dịch và tái hoạt hóa virus",
          "Rối loạn nội tiết",
        ],
        measured: [
          "Giải trình tự metagenomic trên tàu",
          "Calprotectin trong phân và zonulin huyết tương",
          "Tải lượng DNA virus bằng PCR",
          "Panel cytokine",
          "Panel nội tiết nước bọt và huyết tương",
        ],
      },
      {
        name: "Khoảng cách với Trái Đất",
        body: "Chuyến đi Sao Hỏa mất 7 đến 10 tháng và không có tiếp tế. Phi hành đoàn dựa vào kế hoạch kỹ và khả năng tự lực, vì vậy Sky chạy không cần đường truyền về Trái Đất.",
        risks: [],
        measured: [],
      },
    ],
  },
  data: {
    title: "Dữ liệu Sky cần và tiêu chuẩn để đối chiếu",
    lead: "Các giới hạn dưới đây lấy từ NASA-STD-3001 Volume 1 Rev B (Crew Health). Mỗi yêu cầu liên kết về cùng một tài liệu.",
    collectionTitle: "Sky lấy dữ liệu thế nào",
    collection: [
      {
        title: "Tự động",
        body: "Máy móc và công cụ trên tàu đồng bộ số đo với Sky, ví dụ thiết bị tập luyện và thiết bị đeo.",
      },
      {
        title: "Bằng cách hỏi",
        body: "Khi một số đo không có máy, Sky nhắc phi hành gia nhập tay, ví dụ triệu chứng hoặc bữa ăn.",
      },
    ],
    columns: { data: "Dữ liệu", standard: "Tiêu chuẩn", context: "Bối cảnh", requirement: "Yêu cầu" },
    rows: [
      {
        data: "Khả năng hiếu khí tối đa (VO2max)",
        standard: "Tối thiểu 32,9 ml·min⁻¹·kg⁻¹",
        context: "Nhiệm vụ có EVA trong vi trọng lực",
        requirement: "V1 4001",
      },
      {
        data: "Khả năng hiếu khí tối đa (VO2max)",
        standard: "Tối thiểu 36,5 ml·min⁻¹·kg⁻¹",
        context: "Nhiệm vụ có EVA trên bề mặt thiên thể",
        requirement: "V1 4002",
      },
      {
        data: "Lượng dinh dưỡng nạp vào",
        standard:
          "Tối thiểu 90% nhu cầu tính toán, theo tuổi, giới, khối lượng, chiều cao và hệ số hoạt động 1,25",
        context: "Trong nhiệm vụ",
        requirement: "V1 4020",
      },
      {
        data: "Sức mạnh cơ xương",
        standard: "Tối thiểu 80% baseline",
        context: "Trong nhiệm vụ",
        requirement: "V1 4024",
      },
      {
        data: "Khối lượng xương",
        standard: "Hông và cột sống tối thiểu 95% giá trị trước nhiệm vụ, cổ xương đùi tối thiểu 90%",
        context: "Không đo được khi bay. Sky ước tính từ thời gian tập và thuốc dùng.",
        requirement: "V1 4027",
      },
      {
        data: "Tổng liều bức xạ",
        standard: "Dưới 600 mSv",
        context: "Cả sự nghiệp",
        requirement: "V1 4030",
      },
      {
        data: "Liều bức xạ ngắn hạn",
        standard: "Dưới 250 mSv",
        context: "Sự kiện hạt Mặt Trời",
        requirement: "V1 4031",
      },
      {
        data: "Liều bức xạ ngắn hạn",
        standard: "Dưới 20 mSv mỗi năm nhiệm vụ",
        context: "Công nghệ hạt nhân, như nguồn điện đồng vị phóng xạ và lò phân hạch",
        requirement: "V1 4032",
      },
      {
        data: "Cảm giác-vận động phù hợp nhiệm vụ",
        standard: "Định nghĩa theo vận hành",
        context: "Tùy nhiệm vụ",
      },
      {
        data: "Sức khỏe hành vi và nhận thức",
        standard: "Đánh giá sức khỏe hành vi",
        context: "Trong nhiệm vụ",
      },
      {
        data: "Huyết học và miễn dịch",
        standard: "Nằm trong giá trị tới hạn được chấp nhận",
        context: "Trong nhiệm vụ",
      },
    ],
    note: "Các ngưỡng khác Sky dùng, như giới hạn theo từng nhóm rủi ro, là quy tắc theo baseline cá nhân và có nguồn riêng trong ứng dụng.",
  },
  pipeline: {
    title: "Từ tín hiệu đến hành động",
    lead: "Phát hiện là mã deterministic. Mô hình ngôn ngữ chỉ giải thích và soạn nháp. Người trên tàu quyết định.",
    steps: [
      {
        title: "Thu thập",
        body: "Lấy dữ liệu từ máy móc và công cụ đã đồng bộ, hoặc nhắc phi hành gia nhập tay.",
        tag: "Tự động hoặc hỏi",
      },
      {
        title: "Phát hiện",
        body: "So từng chỉ số với baseline của chính phi hành gia: median và độ phân tán, xu hướng, điểm đổi.",
        tag: "Deterministic",
      },
      {
        title: "Đề xuất",
        body: "Nối tín hiệu giữa các hệ, chọn một hành động trong ISS Medical Checklist và giải thích dễ hiểu. Cảnh báo bác sĩ bay và cả đoàn khi rủi ro chung.",
        tag: "AI cục bộ giải thích",
      },
      {
        title: "Xác nhận",
        body: "Không có gì chạy cho đến khi một người bấm Confirm.",
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
    pageTitle: "Câu chuyện | Sky",
    pageDescription: "Truyện hư cấu cho thấy Sky phát hiện, nối tín hiệu và xin phi hành đoàn xác nhận một hành động.",
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
    lead: "Mỗi link ghi ngày mở gần nhất. Link không có ngày là link chặn kiểm tra tự động.",
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
      fiveHazards: { label: "NASA: năm rủi ro của bay vũ trụ có người", note: "Vì sao Sky chia rủi ro thành năm nhóm" },
      nasaStd3001: { label: "NASA-STD-3001 Vol. 1 Rev B", note: "Giới hạn sức khỏe phi hành đoàn trong bảng dữ liệu" },
    },
  },
  footer: {
    line: "Làm cho NASA Space Apps Challenge 2026, TP. Hồ Chí Minh. Không phải sản phẩm chính thức của NASA.",
    license: "Apache-2.0",
    synthetic: "Giá trị demo là mô phỏng và dữ liệu phi hành đoàn là synthetic.",
  },
  sky: {
    startTour: "Sky: bắt đầu tour hướng dẫn",
    stopTour: "Sky: dừng tour hướng dẫn",
    ask: {
      openLabel: "Hỏi Sky để soạn panel này",
      closeLabel: "Đóng ô hỏi Sky",
      placeholder: "Hỏi Sky…",
      submitLabel: "Hỏi Sky",
      answering: "Đang trả lời về",
    },
    waiting: "Sky sẽ ghé chỗ này.",
    composing: "Sky đang dựng bảng này…",
    origin: {
      model: "Soạn bởi model",
      offline: "Model không chạy được, đang hiện bảng có sẵn",
      rejected: "Bảng của model vi phạm quy tắc an toàn, đang hiện bảng có sẵn",
    },
    keyDialog: {
      title: "Sky cần một OpenRouter key",
      cardTitle: "Một key là Sky tự dựng bảng",
      body: "Tôi dựng các bảng này bằng model trên OpenRouter. Dán key của bạn: key chỉ nằm trên chiếc laptop này, không log và không bao giờ hiện lại.",
      fieldLabel: "OpenRouter API key",
      saveLabel: "Lưu key",
      note: "Tạo key tại openrouter.ai/keys. Key chỉ lưu trên máy này, không log, không hiện lại.",
      keepPreset: "Giữ bản dựng sẵn",
      errorInvalid: "Key này không giống OpenRouter key — kiểm tra lại rồi thử lần nữa.",
      errorIo: "Không lưu được key trên máy này. Thử lại.",
      fixKey: "Đặt OpenRouter key…",
    },
    sourceLabel: "Nguồn",
    disclaimer: "Nội dung do AI tạo, không thay thế bác sĩ.",
    stepsLabel: "Chuyện gì xảy ra tiếp theo",
    facts: {
      tripLength: { label: "Chuyến đi Sao Hỏa", value: "7 đến 10 tháng" },
      marsGravity: { label: "Trọng lực bề mặt Sao Hỏa", value: "0,38 so với Trái Đất" },
      radiationCareer: { label: "Tổng liều bức xạ, cả sự nghiệp", value: "Dưới 600 mSv" },
      radiationSolar: { label: "Liều ngắn hạn, sự kiện hạt Mặt Trời", value: "Dưới 250 mSv" },
      muscleStrength: { label: "Sức cơ xương trong nhiệm vụ", value: "Tối thiểu 80% baseline" },
      aerobicSurface: { label: "VO2max cho EVA trên bề mặt thiên thể", value: "Tối thiểu 36,5 ml·min⁻¹·kg⁻¹" },
    },
    goTo: {
      demo: "Mở demo tương tác",
      story: "Đọc câu chuyện",
      concept: "Đọc toàn bộ concept",
      hazards: "Xem năm rủi ro",
      data: "Xem bảng dữ liệu",
      sources: "Xem mọi nguồn",
    },
    stations: {
      console: {
        name: "Bảng điều khiển",
        brief:
          "Người xem vừa mở bảng điều khiển của Sky, chính là ứng dụng. Cho biết Sky giữ gì cho đoàn: chuyến đi mà Sky theo dõi, các giới hạn Sky đối chiếu, và lối ra tới demo tương tác. Ngắn gọn, mang tính vận hành.",
        preset: `root = Console("Bảng điều khiển Sky", [crew, limits, loop])
crew = Card("Ai Sky canh giữ", [badge, say, trip])
badge = Badge("Chạy offline", "info")
say = Say("Mình so từng phi hành gia với chính baseline của họ, rồi soạn một hành động để con người xác nhận.")
trip = Fact("tripLength")
limits = Card("Đoàn giữ được gì", [gravity, muscle])
gravity = Fact("marsGravity")
muscle = Fact("muscleStrength")
loop = Card("Xem cả vòng lặp", [steps, note, next])
steps = Steps(["Mình thấy một thay đổi so với baseline của bạn", "Mình nối nó với các tín hiệu khác", "Mình đề xuất một hành động có trong checklist", "Bạn bấm Xác nhận, rồi báo cáo mới về mặt đất"])
note = Alert("caution", "Không có gì chạy cho tới khi một người bấm Xác nhận.")
next = GoTo("demo")`,
      },
      welcome: {
        name: "Chào mừng",
        brief:
          "Người xem đang đọc trang concept. Giới thiệu Sky: trợ lý lâm sàng offline, so mỗi phi hành gia với baseline của chính họ và đề xuất một hành động để con người xác nhận.",
        preset: `root = Console("Sky", [card])
card = Card("Mình bay cùng đoàn", [say, trip, gravity, next])
say = Say("Mình đi cùng phi hành đoàn và so mỗi người với chính họ của những tuần trước. Bạn cuộn trang, mình bay theo.")
trip = Fact("tripLength")
gravity = Fact("marsGravity")
next = GoTo("demo")`,
      },
      hazards: {
        name: "Rủi ro",
        brief:
          "Người xem đang đọc năm rủi ro của chuyến đi Sao Hỏa: bức xạ, thay đổi trọng lực, cô lập, môi trường kín, khoảng cách tới Trái Đất. Giải thích Sky theo dõi tín hiệu nào cho bức xạ và vì sao dùng cảnh báo thời tiết vũ trụ.",
        preset: `root = Console("Những gì mình canh trên đường đi", [card])
card = Card("Rủi ro không ai cảm thấy", [say, career, solar, note])
say = Say("Bức xạ là rủi ro không ai cảm thấy, nên mình ghép giới hạn liều với cảnh báo thời tiết vũ trụ từ DONKI.")
career = Fact("radiationCareer")
solar = Fact("radiationSolar")
note = Alert("info", "Đây là giới hạn của NASA. Mình theo dõi xu hướng của từng người, mình không chẩn đoán.")`,
      },
      data: {
        name: "Dữ liệu",
        brief:
          "Người xem đang đọc cách Sky thu dữ liệu (tự động từ máy, hoặc hỏi phi hành gia) và các giới hạn NASA-STD-3001 dùng để đối chiếu.",
        preset: `root = Console("Đối chiếu với tiêu chuẩn", [card])
card = Card("Đo được, hoặc phải hỏi", [say, muscle, aerobic, next])
say = Say("Khi không có máy nào đo được, mình hỏi bạn. Sau đó mình đối chiếu với tiêu chuẩn sức khỏe phi hành đoàn của NASA.")
muscle = Fact("muscleStrength")
aerobic = Fact("aerobicSurface")
next = GoTo("sources")`,
      },
      pipeline: {
        name: "Từ tín hiệu tới hành động",
        brief:
          "Người xem đang đọc vòng lặp: thu thập, phát hiện bằng code deterministic, đề xuất một hành động từ ISS Medical Checklist, con người xác nhận, gửi báo cáo về mặt đất sau độ trễ đường truyền.",
        preset: `root = Console("Cách mình đưa bạn một hành động", [card])
card = Card("Code thuần trước, model sau", [say, steps, note])
say = Say("Phần phát hiện là code thường. Mình chỉ giải thích và soạn nháp.")
steps = Steps(["Mình thấy một thay đổi so với baseline của bạn", "Mình nối nó với các tín hiệu khác", "Mình đề xuất một hành động có trong checklist", "Bạn bấm Xác nhận, rồi báo cáo mới về mặt đất"])
note = Alert("caution", "Không có gì chạy cho tới khi một người bấm Xác nhận.")`,
      },
      readiness: {
        name: "Sẵn sàng hạ cánh",
        brief:
          "Người xem đang ở demo tương tác, vài tuần trước khi hạ cánh Sao Hỏa. Một cơn bão Mặt Trời làm bỏ tập hai tuần và độ sẵn sàng tụt dưới baseline. Sky đề xuất một buổi tập phục hồi; người xem phải tự bấm Xác nhận. Giá trị là mô phỏng.",
        preset: `root = Console("Chuẩn bị đứng trên Sao Hỏa", [card])
card = Card("Độ sẵn sàng sau cơn bão", [say, gravity, muscle, note])
say = Say("Hai tuần bỏ tập kéo độ sẵn sàng xuống. Mỗi ngày một buổi tập phục hồi sẽ kéo nó lên lại.")
gravity = Fact("marsGravity")
muscle = Fact("muscleStrength")
note = Alert("caution", "Điểm ở đây là mô phỏng. Bạn bấm Xác nhận, mình không bao giờ bấm thay bạn.")`,
      },
      story: {
        name: "Câu chuyện",
        brief:
          "Người xem mở câu chuyện hư cấu viết bằng tiếng Việt. Bốn phi hành gia, mỗi người có một Sky; một ổ dịch bắt đầu trong khu vườn trên tàu và các Sky nối tín hiệu của cả đoàn.",
        preset: `root = Console("Chuyện về tụi mình", [card])
card = Card("Khi cả đoàn chuyển vàng cùng lúc", [say, trip, next])
say = Say("Câu chuyện là hư cấu. Nó cho thấy các Sky làm gì khi gần hết đoàn chuyển vàng trong cùng một tuần.")
trip = Fact("tripLength")
next = GoTo("demo")`,
      },
    },
  },
};

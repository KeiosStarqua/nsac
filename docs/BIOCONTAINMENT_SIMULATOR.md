# SKY · BioContainment Simulator

> **Trạng thái:** đề xuất / vision — chưa nằm trong phạm vi cam kết của HKT (BOD 18/10, xem root `AGENTS.md`). Lưu lại từ đề xuất của Keios, 2026-11-14. Chưa quyết triển khai; nếu được duyệt, cần cập nhật root `AGENTS.md` (Scope, Work split, Arch) và `ARCHITECTURE.md` trước khi code.

Một mô phỏng dịch tễ học 3D bên trong tàu vũ trụ, kết hợp Digital Twin, mô phỏng lan truyền mầm bệnh, chuyển động của phi hành gia và AI Agent để dự đoán, đánh giá, đề xuất phương án kiểm soát dịch.

Điểm khác biệt so với phần mềm mô phỏng thông thường: người dùng không chỉ xem một animation. Họ có thể hỏi Sky:

> "Nếu một phi hành gia nhiễm bệnh tại khu ngủ, sau 48 giờ dịch bệnh sẽ lan đến những module nào? Nếu cách ly khu ngủ ngay bây giờ thì kết quả thay đổi ra sao?"

Sky sẽ chạy các kịch bản mô phỏng, hiển thị đường lây nhiễm, so sánh kết quả và giải thích quyết định.

## 1. Giao diện 3D nên trông như thế nào?

![Space Company Brand Film Process -- Space Builder](https://images.openai.com/static-rsc-4/uAHOQag6evAe6Hjzz6_yP8PhAg3aEPSEO37qIB2s01af4q5IaPs6dmUiHFcfV5CB1FCpD0GMldinN9E8JWZeKafe5SrsiBYA-ezGTtlSKRIe050OSIpsqIvRsixJud-Wb-nuiS0KqVUN6VJFHDKauHvf9FyTobZZQHbYG480H6-qV7CUvYAWD6nB90h_dTz_?purpose=fullsize)

![ESA - European Columbus laboratory](https://images.openai.com/static-rsc-4/j88zagJvvlpkQ5-yjp52pC09ZkKx6RZheWpm5ntAXLUcfky5-MF_-4ub3UQIsonwLbBsc7eP3m4dMKf5ES1Wl_kCoCvOYSR1oms3fHzhFR5g2fyNdoZDNww0Uk-JRzYu2qHnzZzwolGU7t3BQN0kFuihhm-rZGTdlr0wtY4ZeQ4rHhv0c4yrryv6F2xVZjF4?purpose=fullsize)

![筑梦天宫的数字基石：MultiViz与MakeReal3D共绘航天数智新图景 - 技术栈](https://images.openai.com/static-rsc-4/LGnsSVozVABRkgER276opjYIeWNC4-wgXd7d1DFqFue1515GqP8VniE1oivLQpV8Of6IaW7mtmdPPx9MW2yOCmu7rzILvvPrJ9y56pWGCnZU_Z6cIbRVRfErxrxJD_QW1X0CVsdsoNZJeDOrcbCnDIy83gSA4_bvd8KLcGsnrMueBSyL7fhrfrbLHRol48XU?purpose=fullsize)

![Роскосмос создаст цифровой двойник Российской орбитальной станции: Новости: В России -- Ferra.ru](https://images.openai.com/static-rsc-4/J6c948nwDpCXnypPzhuS_Y8QumjmeaFHYiBqH68gT0J2i2H5-EN7vfrGAbBf9udgD6KI4C6z360rWH1Wl-VfR-OQNrpxmVz_S5czxcvtJZil0XJ4PwpdW_aazPW3DTrOgH9uHfw1qXlAtsUOIoDK_zI4gcXk6Lsl23W3_-k2hyyXTHTxOtgYNL3-FePaAsXF?purpose=fullsize)

![Astronautics: ISS Modules and Layout Infographic | LivePhysics™](https://images.openai.com/static-rsc-4/aSF0KkfTOCWyz7XkAnyT18bcZ3EG176hgZ3p4dlMqx36epOabg2qjd9gkDXS05iIdKpyVajC8nmOCNwTLXI4dlETaOn6Huo6gNuPdBx4svrfOMA6d0NFVRVREP_8jphnzOJ96LZXWODBGzxPlYDd7_0mLPwSm6Qqk5m4xDLjB-XawC7YNRGW0lEAZJ7vEx4l?purpose=fullsize)

![Designing an orbital-scale TESSERAE habitat -- Aurelia Institute](https://images.openai.com/static-rsc-4/9nQW0Id1VDJVRXK_vRSdEOfqfNLY_pla-Lo2SwQ0pNOqLx--s9QRZi0sM_2c19pplfG-2bC0mvLTWYignmghcm9nOGAOWBdCfm__WLVExOmv0tlXvwUXFWReQS848U6PCk7ecz_Wuk9LPxnq6IAKv98AzrgLV0m9JhOGKoKX-Dd0hXMIxxx4ETv6vz1ij7Xj?purpose=fullsize)

![In-Space Manufacturing of Self-Replicating Machines - Tech Briefs](https://images.openai.com/static-rsc-4/1W9TzMLVC3wz4MLSsaMWBkMaKGRiduoq_mH1rNqUmMy-XPIMSoWOmCc6u61wHdlVC28UQmAHHPSbBYruqsWa6kFKZm9acNrROPjq2K7__IdD3iFxZ0wMFBmGpkOc9ehYx-IngaJd56n_HwnRP8Awy0lOnGAQW0RGccqlcbJSaFm1TFHto-5t7cJVZZpWghfK?purpose=fullsize)

![Voskhod-2 Spacecraft With Interior 3D - TurboSquid 2182953](https://images.openai.com/static-rsc-4/6VhKfUOJK-H2ZeCzuxH9-AOBapVXmt-2cRhClVR8O2e8BEAZVMSBBKyyyfQTauxwLHyVoXbLLd_Y4b_V6i17hr_JqfWHE93wAoCp4EC5IDmBImI7TocgiIp7fcplU9T8k4JrcHdImMdeWaK6i0ghLii9OZx0AoM2BrNz8siylUkjwoaKQ4DzhuArkOKf5QSN?purpose=fullsize)

![Class IV Planetary Habitation -- Spacefactory](https://images.openai.com/static-rsc-4/dQD04FBufcaoFeoIaBWCb0u1FJzc27ANQCNIVkO7CJfnWQsvFEBdS6888dTeoqVZlAmjbhHPc_TsYm3Ul5TvOPK76k7YZc8J7fBVK1XaVey5Lqa-CwzgKfqlPzAyuLRi_8FOMX32tiSOkVV68uO_d2E0t35ooYV_-SWSPSuXftCXPAK_nrZQ6YTWErXxQ-ac?purpose=fullsize)

Giao diện trung tâm là mô hình tàu 3D có thể xoay, zoom, tách module, ẩn lớp vỏ và xem bên trong.

Đề xuất 5 lớp hiển thị có thể bật theo ngữ cảnh:

* **Structure:** cấu trúc tàu, module, cửa, hành lang.
* **Crew:** vị trí và chuyển động của phi hành gia.
* **Airflow:** luồng không khí, thông gió và trao đổi khí giữa các module.
* **Pathogen:** nồng độ mầm bệnh giả lập trong không khí và trên bề mặt.
* **Exposure:** lịch sử phơi nhiễm, mức nguy cơ và chuỗi lây truyền ước tính.

Không nên hiển thị cả năm lớp cùng lúc. Sky sẽ chọn lớp quan trọng nhất theo câu hỏi của người dùng.

## 2. Model 3D tàu vũ trụ tìm được

Các model chính thức từ NASA. Để bắt đầu Sky, nên ưu tiên model GLB hoặc glTF vì có thể tích hợp trực tiếp vào Three.js.

![International Space Station (ISS) (C) (High Res) - NASA Science](https://images.openai.com/static-rsc-4/R35CCUHoA2Z2yCR1k6LZMY6s3wPUoQLKjuu3ph_r-MjoOc0BasnOjcblgOoOoha4JjWhE2bhKCseV4AZmbdksJIBW1dqNdpoqdRbZja_uY4RHIyye1nMfczToRYmfWGOQnGNVp3gP4N_qb6UbOBfMqEJsZ2GFYP9NIktHtXuzQoCzb3SdTj97UMShpILETjf?purpose=fullsize)

[NASA International Space Station 3D Model](https://science.nasa.gov/resource/international-space-station-3d-model/?utm_source=chatgpt.com)

Đề xuất bắt đầu: glTF 42.43 MB, có thêm USDZ. Phù hợp làm hình dáng bên ngoài của ISS trong Sky. NASA Science.

![International Space Station (ISS) (D) (IGOAL) - NASA Science](https://images.openai.com/static-rsc-4/m_Oi7MOL4IWZuPzMc1Kjq_OUQA8y147uj_fow3rf53OJW_HgvppeYMZrCxejpMwy63jbNcLCgSGcu_W5yB_vxluLo0Tr4DlG3BiskiYq8xcoMQ_YmrefGBqFrQ1G6p-WVtSONn1snOfcOjKX6z4je5133nkOBKrrhX6FPlOi08XrTqD-5TKSYZ1V-VtU8FfI?purpose=fullsize)

[NASA ISS IGOAL](https://science.nasa.gov/3d-resources/international-space-station-iss-d-igoal/?utm_source=chatgpt.com)

Model GLB từ NASA Johnson Space Center, có cả bản FBX. Phù hợp để kiểm tra cấu trúc và khả năng phân tách các bộ phận. NASA Science.

![International Space Station On White Background](https://images.openai.com/static-rsc-4/qY7x-aSJPcKMPZFjp9e8JYpQF7cZ6_U3O0FjxEYFtt6VewkRawdylmgbPQC-DJ-mmjHf1HkyDhXKmC9hLumiC5WqZV1ckQ0IJQGGH5aFciSr_SvcUPDzj6XrgBaFH7rbiDz5U3k3PSVpWg_pVY7oiOAEBp15IKuTjqQ3aEp59qO-CIYHmEtsw1LkYs_01Ox3?purpose=fullsize)

[NASA ISS Lightweight GLB](https://science.nasa.gov/3d-resources/international-space-station-iss-b/?utm_source=chatgpt.com)

Chỉ khoảng 466 KB, thích hợp làm LOD hoặc prototype trên điện thoại. NASA Science.

Lưu ý quan trọng: Model ISS bên ngoài không tự cung cấp sơ đồ phòng, luồng thông gió, cửa hay hệ thống tọa độ di chuyển của phi hành gia. Cần tạo một **semantic interior model** riêng để mô phỏng dịch bệnh chính xác về mặt logic.

Đề xuất dùng NASA ISS làm lớp vỏ hiển thị, còn bên trong dựng một habitat giả lập với 6–8 module có thông số được khai báo rõ ràng. Nếu Sky hướng đến tàu đi Sao Hỏa, nên đánh dấu đây là **conceptual Mars transit habitat**, không gọi đó là thiết kế tàu NASA đã được xác nhận.

## 3. Animation mô phỏng dịch bệnh

Animation cần biểu diễn sự phơi nhiễm và lây truyền có tính xác suất, không phải chỉ là các hạt virus màu đỏ bay khắp tàu.

Interactive simulation concept — Demo giả lập · 6 phi hành gia · 6 module. Mission elapsed time slider +0h … +72h. (Đây là animation minh họa theo thời gian, chưa chạy mô hình dịch tễ thực hoặc dữ liệu cảm biến.)

### Motion design cho phiên bản 3D thực tế

| Animation           | Chuyển động                                | Ý nghĩa                          |
| ------------------- | ------------------------------------------ | -------------------------------- |
| Airflow streamlines | Các đường cong chuyển động theo hướng quạt | Hướng và lưu lượng thông gió     |
| Aerosol particles   | Hạt trôi, khuếch tán và suy giảm           | Minh họa nồng độ trong không khí |
| Exposure heatmap    | Vùng màu chuyển dần xanh → cam → đỏ        | Nồng độ hoặc mức phơi nhiễm      |
| Crew trajectory     | Phi hành gia di chuyển giữa các module     | Tiếp xúc và lịch trình           |
| Transmission edges  | Đường nối xuất hiện giữa hai người         | Lây truyền được mô hình suy ra   |
| Isolation event     | Cửa chuyển trạng thái, luồng khí thay đổi  | Biện pháp kiểm soát              |
| Forecast ghost      | Lớp tàu trong suốt hiển thị tương lai      | So sánh kịch bản                 |

Không nên sử dụng hàng triệu hạt để tính toán lây nhiễm. Particle animation chỉ là lớp trực quan. Các phép tính thực hiện trên một mô hình toán học riêng.

Về vật lý, môi trường vi trọng lực không có đối lưu tự nhiên giống trên Trái Đất, nên hệ thống quạt và thông gió có vai trò đặc biệt quan trọng. NASA cũng nhấn mạnh nguy cơ hình thành các vùng không khí lưu thông kém.

## 4. Logic mô phỏng dịch bệnh

Đề xuất kiến trúc **Hybrid Agent-Based Model + Compartment Airflow Model + SEIR**.

Ba thành phần này giải quyết ba vấn đề khác nhau (luồng tính toán đơn giản hóa; engine thực tế có thể trao đổi dữ liệu hai chiều giữa các mô hình).

### A. Agent-Based Model: từng phi hành gia

Mỗi phi hành gia là một agent có trạng thái riêng:

```ts
interface CrewAgent {
  id: string;
  locationId: string;
  position: [number, number, number];

  health: {
    infectionState: "S" | "E" | "I" | "R";
    infectionAgeHours: number;
    symptoms: string[];
    viralEmissionRate: number;
  };

  behavior: {
    activity: "sleep" | "work" | "exercise" | "eat";
    movementSchedule: MovementEvent[];
    isolated: boolean;
    maskEfficiency: number;
  };
}
```

Ví dụ, phi hành gia A bị nhiễm nhưng chưa có triệu chứng. A di chuyển từ khu ngủ sang khu ăn uống. Phi hành gia B đang ở đó, và B có thể bị phơi nhiễm tùy theo thời gian tiếp xúc, nồng độ mầm bệnh, thông gió và các yếu tố bảo vệ.

### B. Airflow Model: không khí di chuyển giữa các phòng

Mỗi module có thể được xem như một vùng không khí được trộn đều trong phiên bản MVP.

Nồng độ mầm bệnh giả lập trong module *i*:

$$
\frac{dC_i}{dt} = \frac{E_i}{V_i} + \sum_j \frac{Q_{ji}C_j - Q_{ij}C_i}{V_i} - \lambda_i C_i
$$

Trong đó:

* $C_i$: nồng độ mầm bệnh trong module.
* $E_i$: tổng tốc độ phát thải từ người nhiễm.
* $V_i$: thể tích không khí.
* $Q_{ij}$: lưu lượng khí từ module *i* sang *j*.
* $\lambda_i$: tốc độ loại bỏ do lọc, lắng đọng và bất hoạt, theo giả định mô hình.

Từ nồng độ, Sky tính liều phơi nhiễm tích lũy của từng phi hành gia, sau đó chuyển thành xác suất nhiễm bệnh bằng một mô hình liều–đáp ứng phù hợp.

Quan trọng: Đây là công thức nền tảng, chưa phải mô hình đã được hiệu chuẩn cho một mầm bệnh cụ thể hay tàu vũ trụ thực tế.

### C. Disease Progression: bệnh phát triển theo thời gian

### S → E → I → R

Susceptible → Exposed → Infectious → Recovered. SEIR state machine — quá trình chuyển trạng thái được điều khiển bởi tham số dịch tễ và phân phối xác suất.

Các trạng thái không nên chuyển sau một số giờ cố định cho mọi người. Thời gian ủ bệnh, thời gian lây nhiễm và khả năng lây phải lấy mẫu từ các phân phối đã khai báo.

Với đoàn 6 người, một lần chạy có thể cho kết quả rất khác lần khác. Vì vậy Sky cần chạy nhiều lần Monte Carlo để ước lượng phân phối kết quả và khoảng bất định, thay vì chỉ hiển thị một con số dự báo.

## 5. Logic của Sky AI Agent

Không để LLM trực tiếp tính toán sự lan truyền bệnh. LLM điều phối các engine xác định và giải thích kết quả.

```
User / Astronaut
"What happens if we isolate HAB-02?"
        │
        ▼
Sky Agent Orchestrator
Interpret intent · Validate scenario · Call tools
        │
        ▼
Crew Simulation │ Airflow Solver │ Disease Engine │ Scenario Optimizer
        │
        ▼
Simulation State + Event Log
Versioned inputs · Time series · Uncertainty · Replay
        │
        ▼
Living Interface / 3D Renderer
Scene commands · Timeline · Explanations
```

Workflow:

1. Phi hành gia báo cáo triệu chứng.
2. Sky ghi nhận đây là một sự kiện chưa xác nhận nguyên nhân.
3. Agent truy vấn lịch trình di chuyển, môi trường và dữ liệu sức khỏe được phép truy cập.
4. Sky tạo kịch bản giả định về nguồn lây, không mặc định người đó đã nhiễm bệnh.
5. Engine chạy baseline và các kịch bản kiểm soát.
6. Sky so sánh nguy cơ, chi phí vận hành và tác động tới hệ thống hỗ trợ sự sống.
7. Giao diện hiển thị kết quả 3D, các giả định và mức bất định.
8. Những thay đổi ảnh hưởng đến thông gió, cửa hoặc cách ly phải được con người có thẩm quyền phê duyệt trước khi áp dụng ngoài mô phỏng.

## 6. Tech stack cho Sky (TypeScript + Bun)

| Layer                | Công nghệ đề xuất                    | Vai trò                      |
| -------------------- | ------------------------------------ | ---------------------------- |
| 3D Renderer          | Three.js + React Three Fiber         | Tàu 3D, camera, animation    |
| 3D Assets            | GLB/glTF + Blender                   | Model và semantic geometry   |
| Particle effects     | Three.js InstancedMesh / GPU shaders | Aerosol, luồng khí           |
| Crew movement        | Graph routing + behavior scheduler   | Di chuyển phi hành gia       |
| Simulation core      | TypeScript + Bun                     | SEIR, exposure, airflow      |
| Compute acceleration | Web Workers / WASM                   | Monte Carlo, tính toán nặng  |
| Database             | SQLite                               | Scenario, event, snapshots   |
| Agent                | Sky Tool Calling                     | Điều phối mô phỏng           |
| UI                   | OpenUI + scene command schema        | Giao diện sinh theo ngữ cảnh |

Nên tách **Simulation Engine** khỏi **3D Renderer**. Điều này cho phép chạy headless trên Bun backend, kiểm thử deterministic với random seed cố định, và chỉ gửi state hoặc delta cần thiết cho giao diện.

Các tool mà Sky Agent có thể gọi:

```ts
const simulationTools = {
  createScenario,
  setIndexCase,
  configurePathogen,
  configureVentilation,
  runSimulation,
  compareScenarios,
  getExposureTimeline,
  getCrewRisk,
  inspectModule,
  proposeContainment,
  renderScene,
};
```

Cấu trúc thư mục ban đầu:

```text
apps/
  api/
    src/
      simulation/
        engine.ts
        scheduler.ts
        crew.ts
        disease.ts
        airflow.ts
        exposure.ts
        monte-carlo.ts
      agents/
        simulation-tools.ts
        scenario-orchestrator.ts

  web/
    src/
      features/
        bio-containment/
          SpacecraftScene.tsx
          ModuleInterior.tsx
          CrewAvatars.tsx
          AirflowField.tsx
          ExposureHeatmap.tsx
          SimulationTimeline.tsx
          ScenarioComparison.tsx

packages/
  simulation-schema/
    src/
      types.ts
      events.ts
      commands.ts

assets/
  spacecraft/
    iss.glb
    habitat-interior.glb
    semantic-map.json
```

## 7. Roadmap triển khai

* **Phase 1 — Spacecraft Digital Twin:** Load model NASA, camera orbit, zoom, transparent shell, semantic module mapping, lựa chọn module.
* **Phase 2 — Crew & Airflow:** Sáu phi hành gia, movement schedule, thông gió liên module, animation không khí.
* **Phase 3 — Epidemic Engine:** SEIR, liều phơi nhiễm, mô phỏng xác suất, timeline 72 giờ, Monte Carlo.
* **Phase 4 — Sky Agent Intelligence:** Hỏi đáp bằng ngôn ngữ tự nhiên, so sánh kịch bản, giải thích nguồn dữ liệu và giả định.

## 8. Ba quyết định kiến trúc quan trọng nhất

1. Dùng model NASA ISS để tạo giao diện 3D ban đầu, nhưng xây dựng một semantic habitat riêng. Hình học render không được là nguồn duy nhất xác định luồng khí hoặc khả năng tiếp xúc.
2. Mọi animation phải bắt nguồn từ simulation state. Không cho shader hoặc hiệu ứng tự tạo ra dữ liệu y tế giả rồi để agent diễn giải như dữ liệu thật.
3. Sky phải phân biệt rõ ba loại thông tin: **observed** (đã đo hoặc báo cáo), **simulated** (kết quả mô hình) và **inferred** (suy luận có bất định). Điều này đặc biệt quan trọng khi phần mềm phục vụ sức khỏe phi hành gia.

Với MVP, hướng đề xuất: một habitat 6 module, 6 phi hành gia, một tác nhân hô hấp giả định, timeline 72 giờ và hai kịch bản baseline/cách ly. Phạm vi này đủ để tạo một bản demo 3D có logic thực sự, đồng thời vẫn kiểm thử và mở rộng được.

Mô phỏng nên được thiết kế từ đầu để hoạt động offline, vì Sky hướng đến môi trường tàu vũ trụ và nhiệm vụ Sao Hỏa.

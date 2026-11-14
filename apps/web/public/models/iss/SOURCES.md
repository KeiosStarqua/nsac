# NASA ISS 3D models — nguồn & license

Tải ngày 2026-11-14 từ NASA 3D Resources (science.nasa.gov). Tất cả credit NASA, dùng theo
NASA media usage guidelines: https://www.nasa.gov/nasa-brand-center/images-and-media
(model NASA không có bản quyền ở Mỹ; không được ám chỉ NASA bảo trợ; logo/insignia NASA có hạn chế riêng).

| File | Nguồn | Kích thước | License/Credit |
|---|---|---|---|
| `ISS-B.glb` | [International Space Station (ISS) (B)](https://science.nasa.gov/3d-resources/international-space-station-iss-b/) — glTF binary | 466 KB | NASA media guidelines (như trên) |
| `ISS-stationary.glb` | [International Space Station 3D Model](https://science.nasa.gov/resource/international-space-station-3d-model/) — glTF 42.43 MB | 42.4 MB | NASA Visualization Technology Applications and Development (VTAD); NASA media guidelines |

Ghi chú:

- Model **(D) IGOAL** (https://science.nasa.gov/3d-resources/international-space-station-iss-d-igoal/)
  chỉ có bản **FBX** (93.76 MB zip) trên trang NASA, không có GLB/glTF trực tiếp — không tải; cần
  convert qua Blender nếu muốn dùng.
- Model ISS bên ngoài không có semantic geometry (phòng, cửa, luồng khí, tọa độ crew). Xem
  `docs/BIOCONTAINMENT_SIMULATOR.md` — hướng là dựng semantic interior habitat riêng.
- `ISS-stationary.glb` nặng 42 MB — chỉ nên lazy-load, cân nhắc LOD `ISS-B.glb` cho lần đầu.
- Thư mục `streamed/` là các part tách từ chính `ISS-stationary.glb` (scripts/iss/split-iss.ts;
  world-matrix bake, bounds từ accessor min/max, 131/131 mesh nodes, textures dedup lossless,
  shared textures theo sha256). Cùng nguồn VTAD / credit NASA như `ISS-stationary.glb` ở trên;
  không sửa, không thay thế file gốc. Binary của `streamed/` nằm trong Git LFS.

# 3D models

Tải ngày 2026-11-07. Mỗi thư mục ghi nguồn, commit và license.

| Thư mục | Nội dung | Định dạng | Kích thước | Nguồn | License |
|---|---|---|---|---|---|
| `astrobee/astrobee_freeflyer/` | Robot bay tự do Astrobee (thân, PMC, tay gắp, 4 skin: default, bumble, honey, queen) | COLLADA `.dae` + PNG | 13 MB | https://github.com/nasa/astrobee_media @ `1cb0620121099cc848f5a3db480464188dc91ea3` | Apache-2.0 (`astrobee/LICENSE`, `package.xml`) |
| `astrobee/astrobee_dock/` | Dock sạc của Astrobee | `.dae` + PNG | 7.1 MB | như trên | Apache-2.0 |
| `astrobee/astrobee_handrail_30/` | Tay vịn ISS 30 cm | `.dae` | 0.5 MB | như trên (gốc: RoboNaut2 r2_gazebo) | Apache-2.0 |
| `astrobee/astrobee_iss/` | Nội thất ISS (Node 1–3, JEM, Columbus, US Lab, Cupola, airlock) | `.dae` + PNG | 104 MB | như trên (gốc: IGOAL, https://nasa3d.arc.nasa.gov/detail/iss-internal) | Apache-2.0 |
| `robonaut2/robonaut2.glb` | Robonaut 2, 47 mesh, không rig, không animation | glTF 2.0 binary | 1.1 MB | https://github.com/nasa/NASA-3D-Resources @ `11ebb4ee043715aefbba6aeec8a61746fad67fa7`, `3D Models/Robonaut 2/` | NASA media usage guidelines: https://www.nasa.gov/nasa-brand-center/images-and-media |
| `astronaut/astronaut.glb` | Phi hành gia mặc đồ EMU, 1 mesh, không rig | glTF 2.0 binary | 0.8 MB | như trên, `3D Models/Astronaut/` | NASA media usage guidelines (như trên) |

## Ghi chú dùng

- Avatar cho agent Sky: Astrobee là robot trợ lý bay tự do thật trên ISS, hợp làm hình ảnh agent. Đổi skin bằng các PNG trong `astrobee_freeflyer/media/materials/textures/`.
- Three.js đọc `.dae` bằng `ColladaLoader` và `.glb` bằng `GLTFLoader`. Chưa chuyển `.dae` sang `.glb`.
- Model NASA 3D Resources không có bản quyền ở Mỹ, nhưng không được dùng để ám chỉ NASA bảo trợ, và logo hay insignia của NASA có hạn chế riêng. Xem link guidelines trước khi đưa lên trang nộp.
- `astrobee_iss/` nặng 104 MB. Cân nhắc Git LFS hoặc gitignore trước khi commit.
- Các model đều tĩnh: không có xương (rig) hay animation. Chuyển động của avatar (lơ lửng, xoay, đèn) phải làm bằng code.

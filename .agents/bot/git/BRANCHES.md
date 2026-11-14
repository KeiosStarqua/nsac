# BRANCHES — registry nhánh (git-bot merge gate)

Mọi nhánh code/doc được tạo trong repo này **phải** xuất hiện ở đây với `Status` đúng thực tế. Không nhánh nào được merge ngoài git-bot. Xem `AGENTS.md` (cùng thư mục) cho format + quyền hạn. Git-bot merge theo thứ tự file, một nhánh một lượt.

Người/agent hoàn tất nhánh của mình: đặt `Status: ready` + điền gates + report. Trước đó mọi mục `active` cấm đụng.

---

## remove-space-art — merged 1eed24c
- Status: merged 1eed24c (merge Thủ công bởi CEO bot #2 **trước khi** luật git-bot 2026-11-15 có hiệu lực; nhánh đã xoá)
- Worktree: removed
- Base: origin/main @ 82e2ae9
- Owner: agent t86 (hc) — remove legacy SpaceArt background
- Task: xoá `features/sky-hud/SpaceArt.tsx` + nhánh fallback ở `SkyScreen`/`SkyScreenGen`; background chỉ còn `particles` (mặc định) + `light-tunnel`; `?bg=`/`nsac.bg` lạ → `particles` (ghi đè localStorage)
- Gates: build --force ✅ typecheck ✅ tests 231/231 ✅ (merged tree 1eed24c)
- Report: agent report inline qua hc (không có file)
- Request: đã merge + push + deploy (deploy chạy bởi CEO trước luật git-bot)
- Notes: commit gốc `70329cd`, merge `1eed24c`. Không sửa backend/flake/bun.lock.

## fix/fod-gcroot — active
- Status: active — **KHÔNG merge** (agent đang chạy, branch đã có commit đầu `a7a282b`)
- Worktree: /tmp/opencode/nsac-fod-gcroot
- Base: origin/main @ spawn time (khoảng `00b8c1f..1eed24c`)
- Owner: agent FOD gcroot (session khác) — fix/fod-gcroot
- Task: pin FOD `nsac-web-node-modules` bằng gcroot riêng + fail-closed GC (xem `/tmp/opencode/fod-gcroot-report.md` khi xong)
- Gates: chưa chạy — điền khi agent xong
- Request: merge → origin/main + deploy + tag
- Notes: Agent báo xong qua hc send sẽ đặt `ready`; deploy sau merge phải verify (a) gcroot `nsac-web-node-modules` resolve trực tiếp tới store path, (b) `DRY_RUN=1 nix-gc.sh` không gợi ý GC FOD, (c) `nix build .#web` trên box KHÔNG rebuild FOD.

## holo-hud — ready
- Status: ready
- Worktree: removed (cleaned after ready)
- Base: origin/main @ 00b8c1f
- Owner: agent t84 (hc) — Hologram 3D tối giản cho HUD staged (`/?gen=0`)
- Task: HologramBody R3F tối giản tái dùng skin+skeleton spec từ body-map; script `scripts/holo-model.ts` sinh `anatomy-male-holo.glb`; thay SVG vẽ tay trong SkyScreen; CC BY 4.0 attribution bắt buộc. Commit `b32b87a` "Show the HUD health card's body as a minimal 3D hologram" (branch `holo-hud`, chưa push)
- Gates: build ✅ typecheck ✅ tests 225/225 (34 files) ✅ (worktree gốc agent); entry chunk 350.849 B, `WebGLRenderer` = 0 (chỉ có trong lazy GLTFLoader/three.core); browser: `/?gen=0` 1672×941 canvas 124×234 hiện skin+skeleton 0 console error, `/?gen=1` giữ SVG, `/body` 200, reduced-motion không quay, GLB 404 → SVG fallback, attribution render đúng (không chồng text)
- Request: merge → origin/main + deploy + tag
- Notes: Asset `anatomy-male-holo.glb` 898.972 B (14,6% gốc, 29 mesh, 124.566 tris, meshopt, 0 texture; sha256 d6d3169f…, idempotent script). Attribution `HoloCredit` (Open Anatomy ATTRIBUTION nguyên văn + link CC BY 4.0, ngoài Link). **Bug đã biết (pre-existing, ngoài scope):** WebGL tắt thì `/` đã crash sẵn từ orb CrystalizedBall — cả `/?gen=1`; fallback no-WebGL của thẻ chỉ verify được qua đường GLB-404. `hud-gen`/OpenUI giữ SVG theo quyết định user. Report: `/tmp/opencode/holo-hud-report.md`. Không đụng gen, /body, /watch, bun.lock, flake.nix.

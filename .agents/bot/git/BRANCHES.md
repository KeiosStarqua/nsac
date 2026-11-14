# BRANCHES — registry nhánh (git-bot merge gate)

Mọi nhánh code/doc được tạo trong repo này **phải** xuất hiện ở đây với `Status` đúng thực tế. Không nhánh nào được merge ngoài git-bot. Xem `AGENTS.md` (cùng thư mục) cho format + quyền hạn. Git-bot merge theo thứ tự file, một nhánh một lượt.

Người/agent hoàn tất nhánh của mình: đặt `Status: ready` + điền gates + report. Trước đó mọi mục `active` cấm đụng.

---

## fix/fod-gcroot — active
- Status: active — **KHÔNG merge** (agent đang chạy, branch đã có commit đầu `a7a282b`)
- Worktree: /tmp/opencode/nsac-fod-gcroot
- Base: origin/main @ spawn time (khoảng `00b8c1f..1eed24c`)
- Owner: agent FOD gcroot (session khác) — fix/fod-gcroot
- Task: pin FOD `nsac-web-node-modules` bằng gcroot riêng + fail-closed GC (xem `/tmp/opencode/fod-gcroot-report.md` khi xong)
- Gates: chưa chạy — điền khi agent xong
- Request: merge → origin/main + deploy + tag
- Notes: Agent báo xong qua hc send sẽ đặt `ready`; deploy sau merge phải verify (a) gcroot `nsac-web-node-modules` resolve trực tiếp tới store path, (b) `DRY_RUN=1 nix-gc.sh` không gợi ý GC FOD, (c) `nix build .#web` trên box KHÔNG rebuild FOD.

## holo-hud — active
- Status: active — **KHÔNG merge** (agent đang chạy)
- Worktree: /home/keios/repos/mein/nsac-holo-hud
- Base: origin/main @ 00b8c1f (branch chưa có commit agent lúc ghi)
- Owner: agent holo-hud (session khác) — Hologram 3D tối giản cho HUD staged (`/?gen=0`)
- Task: HologramBody R3F tối giản tái dùng skin+skeleton spec từ body-map; script `scripts/holo-model.ts` sinh `anatomy-male-holo.glb` (≤ ~1.5MB); thay SVG vẽ tay trong SkyScreen; CC BY 4.0 attribution bắt buộc
- Gates: chưa chạy — điền khi agent xong
- Request: merge → origin/main + deploy + tag
- Notes: Report dự định `/tmp/opencode/holo-hud-report.md`. Không đụng gen/OpenUI, /body, /watch.

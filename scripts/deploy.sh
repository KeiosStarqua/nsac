#!/usr/bin/env bash
# deploy.sh — Triển khai Sky (apps/web + apps/backend + apps/ml-inference + marimo notebooks) lên box OpfaOS đồng nhất.
#
# Mọi deploy ĐỀU chạy qua script này (không gõ rsync/nix/symlink bằng tay) để tránh lặp lại
# các sự cố 2026-11-14: mất ~/nsac/result-backend → gcroot lủng lẳng → GC xoá backend (203/EXEC);
# worktree thiếu submodule → /data trả 500; FOD staleness từ bun.lock đổi mà không có hash bump.
#
# 5 gcroot (luôn symlink TRỰC TIẾP tới store path, tạo SAU khi build thành công, TRƯỚC khi gc):
#   nsac-web, nsac-backend — output runtime đang chạy.
#   nsac-inference         — service ML (.#inference). Output này giữ reference tới FOD
#     wheelhouse (share/inference-wheels) nên một gcroot bảo vệ cả hai.
#   nsac-marimo            — service notebooks (.#marimo). Output giữ reference tới FOD
#     wheelhouse (share/marimo-wheels) nên một gcroot bảo vệ cả hai.
#   nsac-web-node-modules  — FOD node_modules (.#nodeModules → result-node-modules). Chỉ là
#     build-time input: không output runtime nào giữ reference, nên không pin thì GC xoá và
#     deploy sau phải `bun install` lại → hash lệch outputHash → nix build fail.
#
# Stage inference là FAIL-SOFT: box/ssh không tới được hoặc unit không cài/khởi động được ⇒
# cảnh báo to + bỏ qua inference (web/backend vẫn deploy, vẫn tag). Nhưng nếu unit chạy mà
# `/health` không trả 200 thì deploy THẤT BẠI (exit 1, không tag) — inference hỏng không được
# coi là deploy thành công. Không rollback web/backend trong trường hợp đó.
#
# Stage marimo mirror stage inference với cùng ngữ nghĩa: box/ssh/build/unit-install lỗi ⇒
# cảnh báo to + bỏ qua (deploy tiếp); nhưng unit chạy mà `/notebooks/` không trả 200 thì deploy
# THẤT BẠI (exit 1, không tag). Packaging .#marimo = FOD wheelhouse per-system
# (chọn theo đề xuất của CEO 2026-11-17; sign-off cuối cùng thuộc về Keios lúc merge/deploy):
# ops/marimo-requirements.txt pin + hash toàn bộ closure, pip download
# --require-hashes, outputHash per-system, không cần mạng sau khi wheels vào Nix store.
#
# Chạy từ BẤT KỲ checkout nào của repo (thường là shared tree hoặc worktree tại main):
#   scripts/deploy.sh                  # deploy origin/main (fetch trước) — mặc định
#   scripts/deploy.sh <ref>            # deploy ref cụ thể (vd. <sha> hoặc deploy-2026-11-14-21)
#   scripts/deploy.sh --dry-run        # chỉ in kế hoạch + rsync --dry-run + remote DRY (không đổi gì)
#   scripts/deploy.sh --no-tag         # bỏ qua annotated tag deploy-YYYY-MM-DD-N (deploy vẫn hoàn tất)
#   scripts/deploy.sh --no-gc          # bỏ qua bước nix-gc.sh cuối cùng
#
# Yêu cầu: git (kèm worktree subcommand), rsync, ssh tới host `opfaos`, curl. git-lfs nếu có LFS.
# Không cần bun/nix ở máy gọi — nix CHỈ chạy trên box (qua ssh), một lần cho mỗi package.
# Deploy-tag: tạo khi origin/main == ref deploy (push kèm tag); lệch thì dừng trước khi tag (rào chắn).
set -euo pipefail

DRY_RUN=0; NO_TAG=0; NO_GC=0; REF=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --no-tag)  NO_TAG=1 ;;
    --no-gc)   NO_GC=1 ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    --*)       echo "deploy.sh: unknown flag: $arg" >&2; exit 2 ;;
    *)         if [ -n "$REF" ]; then echo "deploy.sh: unexpected extra arg: $arg" >&2; exit 2; fi; REF="$arg" ;;
  esac
done

REMOTE_HOST="${DEPLOY_HOST:-opfaos}"
REMOTE_DIR="${DEPLOY_DIR:-/home/ec2-user/nsac}"
REPO_ROOT="$(git rev-parse --show-toplevel)"
[ -f "$REPO_ROOT/flake.nix" ] || { echo "deploy.sh: $REPO_ROOT is not the NSAC repo (no flake.nix)" >&2; exit 1; }
cd "$REPO_ROOT"
command -v rsync >/dev/null || { echo "deploy.sh: cần rsync" >&2; exit 1; }
command -v ssh   >/dev/null || { echo "deploy.sh: cần ssh tới host $REMOTE_HOST" >&2; exit 1; }

git fetch origin main >/dev/null 2>&1 || true
REF="${REF:-origin/main}"
SHA="$(git rev-parse --verify "${REF}^{commit}")"
SHORT_SHA="$(git rev-parse --short=10 "$SHA")"
echo "deploy.sh: target = $REF ($SHORT_SHA) → $REMOTE_HOST:$REMOTE_DIR"

WORKTREE=""
cleanup() {
  if [ -n "$WORKTREE" ] && [ -d "$WORKTREE" ]; then
    # Kiểm trạng thái CỦA WORKTREE deploy (git -C), không phải checkout đang gọi script:
    # người gọi thường có WIP nên check sai chỗ ⇒ rò rỉ worktree deploy.
    if [ -z "$(git -C "$WORKTREE" status --porcelain --untracked-files=no 2>/dev/null)" ]; then
      git worktree remove --force "$WORKTREE" 2>/dev/null || true
    else
      echo "deploy.sh: WORKTREE bẩn, giữ lại để audit: $WORKTREE" >&2
    fi
    git worktree prune 2>/dev/null || true
  fi
}
trap cleanup EXIT

WORKTREE="/home/keios/nsac.worktrees/deploy-${SHORT_SHA}"
mkdir -p /home/keios/nsac.worktrees
rm -rf "$WORKTREE"
git worktree add --detach "$WORKTREE" "$SHA" >/dev/null
( cd "$WORKTREE" && git submodule update --init >/dev/null && if command -v git-lfs >/dev/null; then git lfs pull >/dev/null || true; fi )
[ -f "$WORKTREE/data/DATA.html" ] || { echo "deploy.sh: THIẾU $WORKTREE/data/DATA.html — /data sẽ 500; dừng" >&2; exit 1; }
echo "deploy.sh: worktree sạch @ $SHORT_SHA (submodule data + LFS OK)"

RSYNC_EXCLUDES=(--exclude .git --exclude node_modules --exclude .output --exclude var --exclude result --exclude result-backend --exclude result-inference --exclude result-marimo --exclude result-node-modules --exclude .turbo --exclude .venv --exclude __pycache__ --exclude .pytest_cache --exclude .ruff_cache)
if [ "$DRY_RUN" = "1" ]; then
  rsync -a --delete --dry-run "${RSYNC_EXCLUDES[@]}" "$WORKTREE/" "$REMOTE_HOST:$REMOTE_DIR/" | tail -5
  echo "deploy.sh: DRY_RUN — stage inference sẽ: build .#inference --out-link result-inference; pin gcroot /nix/var/nix/gcroots/nsac-inference; bootstrap-or-restart nsac-inference.service; curl 127.0.0.1:8100/health (fail-soft nếu box/ssh/unit lỗi)."
  echo "deploy.sh: DRY_RUN — stage marimo sẽ: build .#marimo --out-link result-marimo; pin gcroot /nix/var/nix/gcroots/nsac-marimo; bootstrap-or-restart nsac-marimo.service; curl 127.0.0.1:8200/notebooks/ (fail-soft nếu box/ssh/unit lỗi; health != 200 ⇒ exit 1, không tag)."
  echo "deploy.sh: DRY_RUN=1 — không thay đổi gì trên box. Thoát."
  exit 0
fi

rsync -a --delete "${RSYNC_EXCLUDES[@]}" "$WORKTREE/" "$REMOTE_HOST:$REMOTE_DIR/"
echo "deploy.sh: rsync xong (excludes chuẩn: result + result-backend + result-inference + result-marimo + result-node-modules + .turbo + .git)"

ssh "$REMOTE_HOST" "set -euo pipefail
  cd /home/ec2-user/nsac
  sudo -n /root/.nix-profile/bin/nix --extra-experimental-features 'nix-command flakes' build .#web --out-link result 2>&1 | tail -2
  sudo -n /root/.nix-profile/bin/nix --extra-experimental-features 'nix-command flakes' build .#backend --out-link result-backend 2>&1 | tail -2
  # FOD node_modules: build by name rồi pin gcroot riêng — nếu không, GC xoá nó và deploy sau fail hash.
  sudo -n /root/.nix-profile/bin/nix --extra-experimental-features 'nix-command flakes' build .#nodeModules --out-link result-node-modules 2>&1 | tail -2
  # gcroot PHẢI là symlink TRỰC TIẾP tới store path — không đi qua ~/nsac/result* (nix GC không đi qua symlink trung gian).
  sudo ln -sfn \"\$(readlink -f ~/nsac/result)\" /nix/var/nix/gcroots/nsac-web
  sudo ln -sfn \"\$(readlink -f ~/nsac/result-backend)\" /nix/var/nix/gcroots/nsac-backend
  sudo ln -sfn \"\$(readlink -f ~/nsac/result-node-modules)\" /nix/var/nix/gcroots/nsac-web-node-modules
  sudo -n systemctl reset-failed nsac-web nsac-backend
  sudo -n systemctl restart nsac-backend
  sleep 1
  sudo -n systemctl restart nsac-web
  sleep 2
  systemctl is-active nsac-backend nsac-web"
echo "deploy.sh: box build + restart xong"

# ---------------------------------------------------------------------------------------------
# Stage inference (.#inference → nsac-inference.service @ 127.0.0.1:8100) — FAIL-SOFT cho unit,
# HARD cho build (build hỏng thì nix-gc.sh fail-closed cũng chặn, và không nên tag).
BOX_REACHABLE=1
INFERENCE_SKIP=""
if ! ssh -o ConnectTimeout=8 -o BatchMode=yes "$REMOTE_HOST" true 2>/dev/null; then
  BOX_REACHABLE=0
  INFERENCE_SKIP="không ssh được tới $REMOTE_HOST"
else
  ssh "$REMOTE_HOST" "set -euo pipefail
    cd $REMOTE_DIR
    sudo -n /root/.nix-profile/bin/nix --extra-experimental-features 'nix-command flakes' build .#inference --out-link result-inference 2>&1 | tail -2
    sudo ln -sfn \"\$(readlink -f $REMOTE_DIR/result-inference)\" /nix/var/nix/gcroots/nsac-inference
    echo \"deploy.sh: gcroot nsac-inference → \$(readlink -f /nix/var/nix/gcroots/nsac-inference)\""
  echo "deploy.sh: inference build + gcroot xong"

  if ssh "$REMOTE_HOST" "set -euo pipefail
      cd $REMOTE_DIR
      if sudo -n test -f /etc/systemd/system/nsac-inference.service; then
        sudo -n systemctl restart nsac-inference.service
        echo 'deploy.sh: restarted nsac-inference.service'
      else
        sudo -n cp $REMOTE_DIR/ops/nsac-inference.service /etc/systemd/system/nsac-inference.service
        sudo -n systemctl daemon-reload
        sudo -n systemctl enable --now nsac-inference.service
        echo 'deploy.sh: installed + enabled nsac-inference.service'
      fi"; then
    HEALTH_JSON=""
    # uvicorn cần ~vài giây để nạp 26 mô hình; restart trả về trước khi cổng mở ⇒ retry tới 60s.
    for _attempt in $(seq 1 20); do
      HEALTH_JSON="$(ssh "$REMOTE_HOST" 'curl -fsS --max-time 5 http://127.0.0.1:8100/health' 2>/dev/null || true)"
      [ -n "$HEALTH_JSON" ] && break
      sleep 3
    done
    if [ -n "$HEALTH_JSON" ]; then
      echo "deploy.sh: inference /health → $HEALTH_JSON"
    else
      echo "deploy.sh: ❌ inference /health KHÔNG trả 200 — 40 dòng journal cuối:" >&2
      ssh "$REMOTE_HOST" 'sudo -n journalctl -u nsac-inference -n 40 --no-pager' >&2 || true
      echo "deploy.sh: web/backend ĐÃ deploy và KHÔNG rollback; inference hỏng ⇒ deploy thất bại, KHÔNG tag." >&2
      exit 1
    fi
  else
    INFERENCE_SKIP="không cài/khởi động được nsac-inference.service (xem log ssh ở trên)"
  fi
fi

if [ -n "$INFERENCE_SKIP" ]; then
  echo "deploy.sh: ⚠️  BỎ QUA INFERENCE — $INFERENCE_SKIP" >&2
  echo "deploy.sh: ⚠️  web/backend vẫn deploy bình thường (fail-soft). Bootstrap/kiểm tay:" >&2
  echo "deploy.sh: ⚠️    ssh $REMOTE_HOST 'sudo cp $REMOTE_DIR/ops/nsac-inference.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now nsac-inference.service'" >&2
  echo "deploy.sh: ⚠️    ssh $REMOTE_HOST 'curl -fsS http://127.0.0.1:8100/health'" >&2
fi

# ---------------------------------------------------------------------------------------------
# Stage marimo (.#marimo → nsac-marimo.service @ 127.0.0.1:8200) — read-only `marimo run` folder
# mode cho data/notebooks, phục vụ sau Caddy cùng origin tại /notebooks*. Cùng ngữ nghĩa stage
# inference: box/ssh/build/unit-install lỗi ⇒ cảnh báo to + bỏ qua (deploy tiếp); nhưng unit
# chạy mà `/notebooks/` không trả 200 thì deploy THẤT BẠI (exit 1, không tag).
# .#marimo = FOD wheelhouse per-system hash (chọn theo đề xuất của CEO 2026-11-17;
# sign-off cuối cùng thuộc về Keios lúc merge/deploy) — build trên box dùng
# nix store đã có wheels, không cần mạng; deploy.sh pin gcroot nsac-marimo sau build thành công.
MARIMO_SKIP=""
if [ "$BOX_REACHABLE" != "1" ]; then
  MARIMO_SKIP="box không ssh được tới $REMOTE_HOST"
else
  if ! ssh "$REMOTE_HOST" "set -euo pipefail
    cd $REMOTE_DIR
    sudo -n /root/.nix-profile/bin/nix --extra-experimental-features 'nix-command flakes' build .#marimo --out-link result-marimo 2>&1 | tail -2
    sudo ln -sfn \"\$(readlink -f $REMOTE_DIR/result-marimo)\" /nix/var/nix/gcroots/nsac-marimo
    echo \"deploy.sh: gcroot nsac-marimo → \$(readlink -f /nix/var/nix/gcroots/nsac-marimo)\""; then
    MARIMO_SKIP="build/gcroot .#marimo thất bại trên box (xem log ssh ở trên)"
  else
    echo "deploy.sh: marimo build + gcroot xong"

    if ssh "$REMOTE_HOST" "set -euo pipefail
        cd $REMOTE_DIR
        if sudo -n test -f /etc/systemd/system/nsac-marimo.service; then
          sudo -n systemctl restart nsac-marimo.service
          echo 'deploy.sh: restarted nsac-marimo.service'
        else
          sudo -n cp $REMOTE_DIR/ops/nsac-marimo.service /etc/systemd/system/nsac-marimo.service
          sudo -n systemctl daemon-reload
          sudo -n systemctl enable --now nsac-marimo.service
          echo 'deploy.sh: installed + enabled nsac-marimo.service'
        fi"; then
      HEALTH_CODE=""
      # marimo khởi động nhanh nhưng restart trả về trước khi cổng mở ⇒ retry ngắn.
      for _attempt in $(seq 1 10); do
        HEALTH_CODE="$(ssh "$REMOTE_HOST" 'curl -s -o /dev/null -w %{http_code} --max-time 10 http://127.0.0.1:8200/notebooks/' 2>/dev/null || true)"
        [ "$HEALTH_CODE" = "200" ] && break
        sleep 2
      done
      if [ "$HEALTH_CODE" = "200" ]; then
        echo "deploy.sh: marimo /notebooks/ → HTTP 200"
      else
        echo "deploy.sh: ❌ marimo /notebooks/ trả '${HEALTH_CODE:-không phản hồi}' (khác 200) — 40 dòng journal cuối:" >&2
        ssh "$REMOTE_HOST" 'sudo -n journalctl -u nsac-marimo -n 40 --no-pager' >&2 || true
        echo "deploy.sh: web/backend ĐÃ deploy và KHÔNG rollback; marimo hỏng ⇒ deploy thất bại, KHÔNG tag." >&2
        exit 1
      fi
    else
      MARIMO_SKIP="không cài/khởi động được nsac-marimo.service (xem log ssh ở trên)"
    fi
  fi
fi

if [ -n "$MARIMO_SKIP" ]; then
  echo "deploy.sh: ⚠️  BỎ QUA MARIMO — $MARIMO_SKIP" >&2
  echo "deploy.sh: ⚠️  web/backend vẫn deploy bình thường (fail-soft). Bootstrap/kiểm tay:" >&2
  echo "deploy.sh: ⚠️    ssh $REMOTE_HOST 'sudo cp $REMOTE_DIR/ops/nsac-marimo.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now nsac-marimo.service'" >&2
  echo "deploy.sh: ⚠️    ssh $REMOTE_HOST 'curl -fsS http://127.0.0.1:8200/notebooks/'" >&2
fi

if [ "$NO_GC" = "0" ]; then
  if [ "$BOX_REACHABLE" = "1" ]; then
    ssh "$REMOTE_HOST" 'sudo -n bash /home/ec2-user/nsac/scripts/nix-gc.sh'
  else
    echo "deploy.sh: ⚠️  bỏ qua nix-gc.sh (box không tới được)" >&2
  fi
fi

echo "deploy.sh: verify public routes"
BASE="${DEPLOY_BASE_URL:-https://nasa.taquangkhoi.com}"
ROUTES=("/" "/watch" "/?gen=1" "/?gen=0" "/spacecraft" "/body" "/health" "/admin/models" "/data")
FAILED=0
for p in "${ROUTES[@]}"; do
  code="$(curl -s -o /dev/null -w '%{http_code}' -m 30 "$BASE$p")"
  printf '  %s -> %s\n' "$p" "$code"
  [ "$code" = "200" ] || FAILED=1
done
# /admin is a permanent redirect to /admin/models (per-tab routes, 2026-11-16)
code="$(curl -s -o /dev/null -w '%{http_code}' -m 30 "$BASE/admin")"
printf '  %s -> %s\n' "/admin" "$code"
[ "$code" = "307" ] || FAILED=1
for p in "/models/iss/streamed/manifest.json" "/watch/mockup-futuristic-space-gray.png" "/models/anatomy-male.glb"; do
  code="$(curl -s -o /dev/null -w '%{http_code}' -m 30 "$BASE$p")"
  printf '  %s -> %s\n' "$p" "$code"
  [ "$code" = "200" ] || FAILED=1
done
[ "$FAILED" = "0" ] || { echo "deploy.sh: VERIFY FAILED — xem route lỗi phía trên; KHÔNG tag" >&2; exit 1; }

if [ "$NO_TAG" = "0" ]; then
  ORIGIN_SHA="$(git rev-parse --verify origin/main)"
  if [ "$ORIGIN_SHA" = "$SHA" ]; then
    TAG="deploy-$(date +%F)"
    N=2; while git rev-parse "$TAG" >/dev/null 2>&1; do TAG="deploy-$(date +%F)-$N"; N=$((N+1)); done
    git tag -a "$TAG" -m "Deploy ${TAG}: $(git log -1 --format=%s "$SHA")" "$SHA"
    git push origin "$TAG"
    echo "deploy.sh: tag $TAG → $SHA (pushed)"
  else
    echo "deploy.sh: ref $SHORT_SHA != origin/main — BỎ QUA tag (chỉ tag deploy khi main == box)" >&2
  fi
fi
echo "deploy.sh: DONE @ $SHORT_SHA"

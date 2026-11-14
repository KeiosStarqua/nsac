#!/usr/bin/env bash
# deploy.sh — Triển khai Sky (apps/web + apps/backend) lên box OpfaOS một cách đồng nhất.
#
# Mọi deploy ĐỀU chạy qua script này (không gõ rsync/nix/symlink bằng tay) để tránh lặp lại
# các sự cố 2026-11-14: mất ~/nsac/result-backend → gcroot lủng lẳng → GC xoá backend (203/EXEC);
# worktree thiếu submodule → /data trả 500; FOD staleness từ bun.lock đổi mà không có hash bump.
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
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
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
    if [ -z "$(git status --porcelain --untracked-files=no 2>/dev/null)" ]; then
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

RSYNC_EXCLUDES=(--exclude .git --exclude node_modules --exclude .output --exclude var --exclude result --exclude result-backend --exclude .turbo)
if [ "$DRY_RUN" = "1" ]; then
  rsync -a --delete --dry-run "${RSYNC_EXCLUDES[@]}" "$WORKTREE/" "$REMOTE_HOST:$REMOTE_DIR/" | tail -5
  echo "deploy.sh: DRY_RUN=1 — không thay đổi gì trên box. Thoát."
  exit 0
fi

rsync -a --delete "${RSYNC_EXCLUDES[@]}" "$WORKTREE/" "$REMOTE_HOST:$REMOTE_DIR/"
echo "deploy.sh: rsync xong (excludes chuẩn: result + result-backend + .turbo + .git)"

ssh "$REMOTE_HOST" "set -euo pipefail
  cd /home/ec2-user/nsac
  sudo -n /root/.nix-profile/bin/nix --extra-experimental-features 'nix-command flakes' build .#web --out-link result 2>&1 | tail -2
  sudo -n /root/.nix-profile/bin/nix --extra-experimental-features 'nix-command flakes' build .#backend --out-link result-backend 2>&1 | tail -2
  # gcroot PHẢI là symlink TRỰC TIẾP tới store path — không đi qua ~/nsac/result[-backend] (nix GC không đi qua symlink trung gian).
  sudo ln -sfn \"\$(readlink -f ~/nsac/result)\" /nix/var/nix/gcroots/nsac-web
  sudo ln -sfn \"\$(readlink -f ~/nsac/result-backend)\" /nix/var/nix/gcroots/nsac-backend
  sudo -n systemctl reset-failed nsac-web nsac-backend
  sudo -n systemctl restart nsac-backend
  sleep 1
  sudo -n systemctl restart nsac-web
  sleep 2
  systemctl is-active nsac-backend nsac-web"
echo "deploy.sh: box build + restart xong"

if [ "$NO_GC" = "0" ]; then
  ssh "$REMOTE_HOST" 'sudo -n bash /home/ec2-user/nsac/scripts/nix-gc.sh'
fi

echo "deploy.sh: verify public routes"
BASE="${DEPLOY_BASE_URL:-https://nasa.taquangkhoi.com}"
ROUTES=("/" "/watch" "/?gen=1" "/?gen=0" "/spacecraft" "/body" "/health" "/admin" "/data")
FAILED=0
for p in "${ROUTES[@]}"; do
  code="$(curl -s -o /dev/null -w '%{http_code}' -m 30 "$BASE$p")"
  printf '  %s -> %s\n' "$p" "$code"
  [ "$code" = "200" ] || FAILED=1
done
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

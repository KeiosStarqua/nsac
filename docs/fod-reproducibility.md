# FOD reproducibility — `nsac-web-node-modules`

`flake.nix` builds the dependency tree as a fixed-output derivation (`bun install
--frozen-lockfile`, then `cp -a node_modules $out/node_modules`). Its store path is the
recursive NAR hash of that output, pinned per system in `outputHash`. Two builds of the same
`bun.lock` on the same architecture are *not* byte-identical. Observed causes:

- **bun's hoisted layout carries an install id.** Packages live in
  `node_modules/.bun/<name>@<version>+<install-id>/`; the id encodes bun's peer-graph
  resolution, and every `node_modules/<pkg>` symlink points into one of those directories.
  A different id rewrites all symlink targets → different hash.
- **Optional native deps per platform/libc.** The tree contains both `gnu` and `musl` builds of
  `lightningcss`, `@tailwindcss/oxide`, `@rolldown/binding`, `@libsql/*`, `@img/sharp-*`,
  `@esbuild/linux-*`. Which variants bun materializes depends on arch/libc detection in the
  build environment, which is why `outputHash` is already per system — and why the same arch
  can still diverge when detection sees a different sandbox.
- **Lifecycle scripts run during install** (`esbuild` and `protobufjs` have `postinstall`).
  They may copy platform binaries, consult the registry, or skip when env/network differs, so
  their output is not a pure function of the lockfile.
- **Build-time network.** Frozen lockfile pins versions and integrity, but tarball availability
  (mirror, cache miss, registry error path) still decides whether the install completes
  identically.

Ruled out: **mtimes and directory order**. Nix normalizes timestamps in NAR (store entries
show epoch) and sorts entries, so `cp -a` and install order do not affect the hash. Also
verified on the current output: no absolute or dangling symlinks and no `nix-build-*` strings,
so `dontFixup` / `dontPatchShebangs` are not a drift source (they only prevent shebang writes
into store paths, which a FOD must not reference).

**Does the gcroot fully protect the pinned aarch64 hash?** Yes, as long as the output is in the
store. `outputHash` fixes the output path, so once built, `nix build .#web` / `.#backend` reuse
it and never re-run `bun install`; the gcroot keeps it valid across `nix-store --gc`. The only
way to need the network again is a lockfile change (or an `outputHash` bump), which demands a
new hash → one rebuild on the box → pinned by the same deploy.

---

# FOD reproducibility — `nsac-inference-wheels` (service ML)

`flake.nix` cũng có một FOD thứ hai cho `apps/ml-inference`: `.#inferenceWheels` = **wheelhouse**
(`uv export --frozen --no-dev --no-emit-project` → `pip download --only-binary=:all:`), pin
`outputHash` theo platform:

- `x86_64-linux` — `sha256-f0wHlsmQQrOU2HAcPaiyAh4xcuzv3e/CxnPiN6Vd67M=`
- `aarch64-linux` — `sha256-Z8rJBrfBCrcUWa64TxH3YcoHdLlGLrIAbIul8B9lziE=` (lấy bằng build fakeHash trên box)

**Vì sao không phải FOD venv** (như `.#nodeModules` cho `bun install`): nix cấm output FOD tham chiếu
store path. Venv luôn tham chiếu interpreter (`pyvenv.cfg` → `home = /nix/store/...python3.12...` và
shebang `$out/bin/python`), nên build FOD venv với hash đúng sẽ chết:

```text
error: fixed-output derivations must not reference store paths:
  '...-fod-selfref.drv' references 1 distinct paths, e.g. '...-fod-selfref'
```

(đã kiểm bằng probe tối thiểu). Vì vậy tách đôi: FOD = wheel (cần mạng) → derivation thường
`.#inference` lắp venv từ wheelhouse bằng `uv pip install --no-index --find-links`, `autoPatchelfHook`
sửa RPATH cho wheel manylinux (libstdc++/libgcc_s/libz), rồi ghi wrapper `bin/sky-inference`.

**Hệ quả & quy tắc:**

- Hash chỉ phụ thuộc `uv.lock` + platform (không phụ thuộc code `apps/ml-inference` hay nội dung
  `data/`) ⇒ sửa code service KHÔNG cần bump hash; đổi dependency thì PHẢI bump.
- `nix build .#inferenceWheels` với `lib.fakeHash` ở đúng platform để đọc hash thật từ lỗi
  hash mismatch (x86_64 build local; aarch64 build trên box — `ec2-user`, qua `sudo -n /root/.nix-profile/bin/nix`).
- gcroot: output `.#inference` chứa symlink `share/inference-wheels` → FOD, nên gcroot
  `/nix/var/nix/gcroots/nsac-inference` giữ cả hai; không cần gcroot riêng cho wheelhouse.
- Venv do `.#inference` tạo vẫn tham chiếu `pkgs.python312` ⇒ bump nixpkgs có thể đổi store path
  python (hash FOD giữ nguyên vì wheel không đổi); chỉ cần build lại `.#inference` qua deploy.

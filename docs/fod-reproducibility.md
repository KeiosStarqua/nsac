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

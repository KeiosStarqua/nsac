{
  description = "NSAC — Sky web app (TanStack Start / Nitro, bun preset)";

  inputs = {
    nixpkgs.url = "https://channels.nixos.org/nixpkgs-unstable/nixexprs.tar.zst";
  };

  outputs = inputs:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAll = f: inputs.nixpkgs.lib.genAttrs systems (system: f inputs.nixpkgs.legacyPackages.${system});
    in
    {
      packages = forAll (pkgs:
        let
          # Fixed-output derivation: bun install needs network, so the dependency
          # tree is fetched here with a pinned hash. Bump outputHash when bun.lock changes
          # (build once with inputs.nixpkgs.lib.fakeHash to read the real one from the error).
          nodeModules = pkgs.stdenv.mkDerivation {
            pname = "nsac-web-node-modules";
            version = "0.0.0";
            src = ./.;
            nativeBuildInputs = [ pkgs.bun ];
            # FOD outputs may not reference store paths; skip shebang rewriting.
            dontFixup = true;
            dontPatchShebangs = true;
            buildPhase = ''
              export HOME=$TMPDIR
              export BUN_INSTALL_CACHE_DIR=$TMPDIR/bun-cache
              bun install --frozen-lockfile
            '';
            installPhase = ''
              mkdir -p $out
              cp -a node_modules $out/node_modules
              for d in apps/*/node_modules; do
                [ -d "$d" ] || continue
                mkdir -p "$out/$(dirname "$d")"
                cp -a "$d" "$out/$d"
              done
            '';
            outputHashMode = "recursive";
            # The FOD output differs per platform (optional native deps), so pin a hash per system.
            outputHash = {
              x86_64-linux = "sha256-VwsQBUsjG9SBEUeq5KVvPbZ4Qk7P9ZOkPD5nVOy3nBo=";
              aarch64-linux = "sha256-uZ/MS7sLyNU/tYEKNjBa+uBVD8giE7v5a9Bv62Y49bU=";
            }.${pkgs.stdenv.hostPlatform.system};
          };
        in
        {
          web = pkgs.stdenv.mkDerivation {
            pname = "nsac-web";
            version = "0.0.0";
            src = ./.;
            nativeBuildInputs = [ pkgs.bun pkgs.nodejs ];
            buildPhase = ''
              export HOME=$TMPDIR
              cp -a ${nodeModules}/node_modules ./node_modules
              for d in ${nodeModules}/apps/*/node_modules; do
                [ -d "$d" ] || continue
                rel="''${d#${nodeModules}/}"
                mkdir -p "$(dirname "$rel")"
                cp -a "$d" "$rel"
              done
              chmod -R u+w .
              cd apps/web
              # .bin shims use /usr/bin/env node, absent in the nix sandbox; run vite via bun instead.
              bun ./node_modules/vite/bin/vite.js build
            '';
            installPhase = ''
              mkdir -p $out/lib/nsac-web $out/bin
              cd apps/web 2>/dev/null || cd "$NIX_BUILD_TOP"/*/apps/web
              cp -a .output $out/lib/nsac-web/.output
              cat > $out/bin/nsac-web <<EOF
#!${pkgs.runtimeShell}
# Production server. PORT defaults to 3100 (see apps/web/AGENTS.md); no secrets are read or required.
export PORT="''${PORT:-3100}"
exec ${pkgs.bun}/bin/bun $out/lib/nsac-web/.output/server/index.mjs
EOF
              chmod +x $out/bin/nsac-web
            '';
          };

          # Backend: no build step — bun runs TypeScript directly. Reuses the same FOD
          # (it already contains apps/backend's deps); only the runtime layout is assembled here.
          backend = pkgs.stdenv.mkDerivation {
            pname = "nsac-backend";
            version = "0.0.1";
            src = ./.;
            nativeBuildInputs = [ pkgs.bun ];
            dontFixup = true;
            dontPatchShebangs = true;
            installPhase = ''
              mkdir -p $out/lib/nsac-backend/apps $out/bin
              cp -a apps/backend $out/lib/nsac-backend/apps/backend
              # Bỏ node_modules lẫn trong source (nix src copy cả file untracked) — bản trong FOD mới là chuẩn.
              chmod -R u+w $out/lib/nsac-backend/apps/backend
              rm -rf $out/lib/nsac-backend/apps/backend/node_modules
              cp -a ${nodeModules}/node_modules $out/lib/nsac-backend/node_modules
              for d in ${nodeModules}/apps/*/node_modules; do
                [ -d "$d" ] || continue
                rel="''${d#${nodeModules}/}"
                mkdir -p "$out/lib/nsac-backend/$(dirname "$rel")"
                cp -a "$d" "$out/lib/nsac-backend/$rel"
              done
              chmod -R u+w $out/lib/nsac-backend
              cat > $out/bin/nsac-backend <<EOF
#!${pkgs.runtimeShell}
# Backend API. PORT defaults to 3200; SKY_DB_PATH defaults to the box's var dir.
export PORT="\''${PORT:-3200}"
export SKY_DB_PATH="\''${SKY_DB_PATH:-/home/ec2-user/nsac/var/sky.db}"
exec ${pkgs.bun}/bin/bun $out/lib/nsac-backend/apps/backend/src/server.ts
EOF
              chmod +x $out/bin/nsac-backend
            '';
          };

          default = inputs.self.packages.${pkgs.stdenv.hostPlatform.system}.web;
        });

      apps = forAll (pkgs: {
        web = {
          type = "app";
          program = "${inputs.self.packages.${pkgs.stdenv.hostPlatform.system}.web}/bin/nsac-web";
        };
        backend = {
          type = "app";
          program = "${inputs.self.packages.${pkgs.stdenv.hostPlatform.system}.backend}/bin/nsac-backend";
        };
        default = inputs.self.apps.${pkgs.stdenv.hostPlatform.system}.web;
        # gc dọn store path mồ côi của các bản deploy cũ (bảo vệ bằng gcroots
        # /nix/var/nix/gcroots/nsac-{web,backend}). Pure build không xóa được store,
        # nên đây là app (impure, cần chạy với sudo trên box). Khi disk gần đầy tới
        # mức nix không unpack nổi nixpkgs, chạy thẳng: sudo bash scripts/nix-gc.sh
        gc = {
          type = "app";
          program = ./scripts/nix-gc.sh;
        };
      });
    };
}

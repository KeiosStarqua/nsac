{
  description = "NSAC — Sky web app (TanStack Start / Nitro, bun preset)";

  inputs = {
    nixpkgs.url = "https://channels.nixos.org/nixpkgs-unstable/nixexprs.tar.zst";

    # Submodule `data/` (pipeline sky-ml: models, features, configs, source của package `sky_ml`).
    # Rev PHẢI bằng đúng gitlink của submodule: `git submodule status data` → khi bump submodule
    # phải bump rev ở đây trong CÙNG commit, nếu không `.#inference` phục vụ artifact khác với
    # checkout. `flake = false`: chỉ cần cây file, không có outputs Nix.
    nsac-data = {
      url = "github:wosonday/nsac-data/c76d50d1df2aaffc07b41da8813519b5372c3dce";
      flake = false;
    };
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
              x86_64-linux = "sha256-bCqdbr6jtvnDnYMwqadqGiMugqyfEzlQOj8mpT2HGTs=";
              aarch64-linux = "sha256-WU17sz/oZd/oU8ZLz9Vc8hzeM4jcCk4cRogGOH+RMhk=";
            }.${pkgs.stdenv.hostPlatform.system};
          };

          # ---------------------------------------------------------------------------------
          # Sky ML inference (apps/ml-inference) — xem apps/ml-inference/AGENTS.md.
          #
          # `inferenceSrc`: cây "repo + submodule" (./. trừ gitlink data/ + nsac-data ở data/)
          # để lệnh build nhìn thấy đúng layout của một checkout thật.
          inferenceSrc = pkgs.runCommand "nsac-inference-src" { } ''
            mkdir -p $out
            cp -a ${./.}/. $out/
            chmod -R u+w $out
            rm -rf $out/data
            cp -a ${inputs.nsac-data} $out/data
          '';

          # FOD: chỉ tải WHEEL (.whl) về một wheelhouse — không chứa venv.
          #
          # Vì sao không phải FOD venv như .#nodeModules: nix CẤM output của FOD tham chiếu
          # store path. Venv luôn tham chiếu interpreter (`pyvenv.cfg` + shebang
          # `$out/bin/python`), nên build FOD venv với hash đúng sẽ bị:
          #   error: fixed-output derivations must not reference store paths
          # (đã kiểm bằng probe). Vì vậy: FOD = wheelhouse (network + hash theo platform),
          # còn venv được lắp trong derivation thường `inference` bên dưới (không cần mạng).
          # Wheels khác nhau theo platform ⇒ outputHash per system, bump khi uv.lock đổi.
          inferenceWheels = pkgs.runCommand "nsac-inference-wheels-1.0.0" {
            nativeBuildInputs = [ pkgs.uv pkgs.python312 pkgs.python312Packages.pip pkgs.cacert ];
            dontFixup = true;
            dontPatchShebangs = true;
            outputHashMode = "recursive";
            # Cả hai platform đã pin hash THẬT (không còn fakeHash): x86_64 build tại local,
            # aarch64 build trên box OpfaOS rồi đối chiếu `nix hash path` → khớp đúng SRI dưới đây.
            # Bump khi uv.lock đổi; lấy hash mới bằng lib.fakeHash (xem docs/fod-reproducibility.md).
            outputHash = {
              x86_64-linux = "sha256-f0wHlsmQQrOU2HAcPaiyAh4xcuzv3e/CxnPiN6Vd67M=";
              aarch64-linux = "sha256-Z8rJBrfBCrcUWa64TxH3YcoHdLlGLrIAbIul8B9lziE=";
            }.${pkgs.stdenv.hostPlatform.system};
          } ''
            export HOME=$TMPDIR
            export UV_PYTHON_DOWNLOADS=never
            export UV_CACHE_DIR=$TMPDIR/uv-cache
            export SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt
            cd ${inferenceSrc}/apps/ml-inference
            uv export --frozen --no-dev --no-emit-project --no-hashes -o $TMPDIR/requirements.txt
            mkdir -p $out
            ${pkgs.python312}/bin/python -m pip download \
              --no-deps --only-binary=:all: --disable-pip-version-check --no-cache-dir \
              --requirement $TMPDIR/requirements.txt --dest $out
          '';
        in
        {
          # Dependency tree FOD, exposed by name so deploy.sh can build it and pin its own
          # gcroot. It is a BUILD-TIME input only — neither web nor backend keeps a runtime
          # reference to it, so without a gcroot `nix-store --gc` deletes it and the next
          # build has to re-run `bun install`, whose output no longer matches outputHash.
          nodeModules = nodeModules;

          # Wheelhouse FOD của service suy luận — expose riêng để build/pin hash theo platform
          # (deploy.sh build .#inference, nó tự kéo FOD này).
          inferenceWheels = inferenceWheels;

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

          # Service suy luận (FastAPI, 127.0.0.1:8100) — hợp đồng ở apps/ml-inference/AGENTS.md.
          # Không build step: PYTHONPATH trỏ thẳng source (apps/ml-inference/src + data/src), venv
          # chỉ chứa thư viện. Nhờ vậy hash FOD wheelhouse KHÔNG đổi khi sửa code service.
          # `share/inference-wheels` là symlink tới FOD: output này giữ reference ⇒ gcroot
          # /nix/var/nix/gcroots/nsac-inference bảo vệ luôn wheelhouse, không cần root riêng.
          inference = pkgs.stdenv.mkDerivation {
            pname = "nsac-inference";
            version = "1.0.0";
            dontUnpack = true;
            # Wheel manylinux liên kết libstdc++/libgcc_s/libz của hệ thống ⇒ autoPatchelfHook
            # sửa RPATH sang store path (fixupPhase chạy như mọi derivation thường).
            nativeBuildInputs = [ pkgs.uv pkgs.python312 pkgs.autoPatchelfHook ];
            buildInputs = [ pkgs.stdenv.cc.cc.lib pkgs.zlib ];
            buildPhase = ''
              export HOME=$TMPDIR
              export UV_PYTHON_DOWNLOADS=never
              export UV_CACHE_DIR=$TMPDIR/uv-cache
              cd ${inferenceSrc}/apps/ml-inference
              uv export --frozen --no-dev --no-emit-project --no-hashes -o $TMPDIR/requirements.txt
              uv venv --python ${pkgs.python312}/bin/python3.12 $out
              uv pip install --python $out/bin/python --no-index \
                --find-links ${inferenceWheels} --requirements $TMPDIR/requirements.txt
            '';
            installPhase = ''
              mkdir -p $out/share
              ln -s ${inferenceWheels} $out/share/inference-wheels
              cat > $out/bin/sky-inference <<EOF
#!${pkgs.runtimeShell}
# Sky ML inference — wrapper sinh bởi flake.nix (.#inference). Không đọc secrets.
# SKY_DATA_ROOT trỏ vào input nsac-data, nên service không phụ thuộc checkout nào trên box.
export SKY_DATA_ROOT="\''${SKY_DATA_ROOT:-${inputs.nsac-data}}"
export SKY_ML_SRC="\''${SKY_ML_SRC:-${inputs.nsac-data}/src}"
export PYTHONPATH="${inferenceSrc}/apps/ml-inference/src:${inputs.nsac-data}/src\''${PYTHONPATH:+:\$PYTHONPATH}"
export SKY_INFERENCE_HOST="\''${SKY_INFERENCE_HOST:-127.0.0.1}"
export SKY_INFERENCE_PORT="\''${SKY_INFERENCE_PORT:-8100}"
exec $out/bin/python -m sky_inference "\$@"
EOF
              chmod +x $out/bin/sky-inference
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
        inference = {
          type = "app";
          program = "${inputs.self.packages.${pkgs.stdenv.hostPlatform.system}.inference}/bin/sky-inference";
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

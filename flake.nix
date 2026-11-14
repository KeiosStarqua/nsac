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
          # (build once with lib.fakeHash to read the real one from the error).
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
              x86_64-linux = "sha256-6+XOqDciSKAB8EkJrkPKrOwle7Hxn4kBTqDB5lVoGmM=";
              aarch64-linux = "sha256-qWI+g00SAXssHRnCWwcIxpS+8qNwhWg2rHIMigjlhOw=";
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

          default = inputs.self.packages.${pkgs.stdenv.hostPlatform.system}.web;
        });

      apps = forAll (pkgs: {
        web = {
          type = "app";
          program = "${inputs.self.packages.${pkgs.stdenv.hostPlatform.system}.web}/bin/nsac-web";
        };
        default = inputs.self.apps.${pkgs.stdenv.hostPlatform.system}.web;
      });
    };
}

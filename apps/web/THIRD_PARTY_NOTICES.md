# Third-party notices (apps/web)

## uiarc.dev (Arc UI)

- Licence/terms: per uiarc.dev
- Link: https://uiarc.dev
- Items taken: all FREE items installed 2026-11-14 via the official shadcn CLI from the public registry (`https://uiarc.dev/r/{name}.json`) — foundation (`arc-foundation`), 116 components, 19 blocks, 1 special component (`slot-text`). Pro items are NOT included.
- Location: apps/web/src/shared/arc/
- Installed with `bunx shadcn@latest add --yes @uiarc/<name>`; `components.json` holds the registry configuration.
- Notes: three blocks (`changelog-feed`, `newsletter-signup`, `site-header`) originally imported `next/image`; the import was swapped for Arc's own framework-free `ArcImage` from `src/shared/arc/lib/arc-provider.tsx` (renders a plain `<img>`). No other behavior changes. `foundation.css` defines generic tokens (`--background`, `--foreground`, ...) and is NOT imported globally — see apps/web/AGENTS.md.
- Not wired into routes, HUD, features, or agent code; vendored only.
- Date: 2026-11-14

## React Bits

- Licence: MIT + Commons Clause
- Link: https://github.com/DavidHDev/react-bits
- Components taken: all 57 (7 prior + 50 new)
- Location: apps/web/src/shared/react-bits/
- Licence file: apps/web/src/shared/react-bits/LICENSE.md
- Date: 2026-11-14

## glTF Transform (@gltf-transform/*)

- Licence: MIT
- Link: https://github.com/donmccurdy/glTF-Transform
- Packages taken: `@gltf-transform/core` 4.5.1, `@gltf-transform/functions` 4.5.1, `@gltf-transform/extensions` 4.5.1 (pinned, root `devDependencies`)
- Used by: the offline ISS asset pipeline (`scripts/iss/split-iss.ts`, `scripts/iss/verify-iss.ts`) only — never shipped to the browser; the streamed parts keep NASA content only
- Licence file: `node_modules/@gltf-transform/core/LICENSE.md`
- Date: 2026-11-14

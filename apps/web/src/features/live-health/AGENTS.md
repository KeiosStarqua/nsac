# features/live-health

## Purpose

Client for the live (simulated) health feed — the frozen backend contract
`GET /api/health/live/:astronautId`:

```
{ ok: true, live: boolean, updatedAt: string | null, source: "sim" | "seed" | "none",
  metrics: Record<string, { value: number, unit: string, quality: string }> }
```

It owns four things: the payload type + lenient parse, the 5 s poll hook, the `/performance`
LIVE vitals strip, and the pure overlay that binds the `/` console's vital rows to the feed.
Every reading is synthetic habitat telemetry for the fictional crew — `live: true` means "the
simulation is running and the reading is fresh", never a real clinical measurement.

## Ownership

- This feature owns `model/liveHealth.ts` (types, parse, state fold, strip mode, HUD overlay),
  `model/strip.ts` (strip view model), `model/useLiveHealth.ts` (React hook), `api/liveHealth.ts`
  (browser fetch seam) and `api/liveHealth.server.ts` (loopback transport).
- The web proxy route `apps/web/src/routes/api/health.live.$astronautId.ts` (web path
  `/api/health/live/:astronautId`) is the only caller of the transport. The backend route itself
  belongs to `apps/backend`.
- Consumers: `features/performance/components/PerformancePage.tsx` (strip) and
  `features/hud-gen/SkyScreenGen.tsx` (vital rows). Nothing else imports it.

## Local Contracts

- **Poll cadence** is 5 s (`LIVE_POLL_MS`), never 1 Hz: one request per cycle, chained after the
  previous one settles, in-flight aborted before the next, on astronaut change and on unmount.
  The poll pauses while `document.visibilityState === "hidden"` and re-reads immediately when the
  tab becomes visible again.
- **Last good payload survives**: a failed poll marks `stale: true` and keeps `data`; the strip
  never flaps to the offline label while data is held.
- **The strip has three honest states** (`liveStripMode`): `live` (payload fresh, `source !== "seed"`),
  `historical` (seed / `live: false` with metrics) and `offline` (no payload, or a payload with no
  metrics). It renders `null` until the first read settles, so SSR and first paint never flash a
  state.
- **Proxy degradation**: when the backend is unreachable / times out / has no route yet, the web
  proxy answers `200` with the contract's own empty envelope (`source: "none"`, empty `metrics`)
  and `x-live-degraded: unavailable|timeout` — not a 5xx — so a backend outage does not paint a
  failed request in the browser console every 5 s. Unknown body keys never leave the server; the
  route keeps the house `sec-fetch-site` guard and the 1500 ms loopback timeout.
- **Console binding** (`applyLiveVitals`) replaces values only, keeps the fixture's units and
  deterministic sparklines, and returns the fixture object untouched when nothing applies — the
  `/` fallback markup must stay byte-identical (screenshots depend on it).
- **Labelling**: `live.*` copy (en/vi parity test) keeps the words LIVE / HISTORICAL / OFFLINE
  plus "simulated". Metrics values are `aria-live="polite"`; the pulsing dot is `aria-hidden` and
  pulses only while `live && !stale`, under `motion-safe:` so reduced motion stops it.
- No new dependencies, no medical thresholds, no console-switch behaviour change.

## Work Guidance

- Keep `model/` free of React and IO; the hook is the only React file and the transport the only
  IO. Unit-test the seams (parse, state fold, strip model, overlay, fetch with a fake `fetch`)
  rather than the effect — this package's vitest runs in a node environment with no DOM.
- A new strip metric: add the id to `LIVE_METRIC_IDS`, its unit to `LIVE_METRIC_UNITS`, then the
  order + label in `LIVE_STRIP_ORDER` / `live.*` copy (both locales). Values stay English units.
- A contract change needs a coordinated update: parse, strip model, transport and the proxy route
  together, and the backend branch that serves it.

## Verification

- `cd apps/web && npx vitest run src/features/live-health` covers parse, state fold, strip modes,
  the console overlay, the fetch fallback and the loopback transport.
- Full gates from the repo root: `bunx turbo run build --force` (generates `routeTree.gen.ts`),
  `bun run typecheck`, `cd apps/web && npx vitest run`.
- Live smoke (backend up): `curl -s http://127.0.0.1:<web>/api/health/live/ayla-reyes` returns the
  payload; with the backend down the same URL returns the empty envelope + `x-live-degraded`.

## Child DOX Index

| Path | Scope |
|---|---|
| — | No child boundaries. |

/**
 * @deprecated (Keios, 2026-11-16) Hub Mock is deprecated — we only use Hub Gen with OpenUI.
 * Do not extend. This module's presentational components are still the shared vocabulary of
 * `features/hud-gen/catalog.tsx`; they will move into `hud-gen/` and this folder will be
 * deleted (see AGENTS.md "Hub Mock DEPRECATED").
 */
export { SkyHudMock } from "./SkyHudMock";
export { buildInsightText } from "./model/insight";
export { roleLabel } from "./model/roles";
export {
  HUD_MOCK,
  MISSION_DAY,
  formatBloodPressure,
  formatSleep,
  signedKcal,
  type HudMockFixture,
} from "./model/fixture";
export {
  ROWS_BY_TAB,
  TAB_IDS,
  buildPanels,
  groupThousands,
  type Panel,
  type PanelRow,
  type RowId,
  type TabId,
} from "./model/panels";
export { buildSeries, sparklinePath, type SparklineGeometry } from "./model/sparklines";
export { ProfileCard } from "./components/ProfileCard";
export { VitalsCard } from "./components/VitalsCard";
export { TrendsCard } from "./components/TrendsCard";
export { ReadinessCard, ReadinessDetail, MiniCards } from "./components/ReadinessPanel";
export { InsightBand } from "./components/InsightBand";
export { Sparkline } from "./components/Sparkline";
export { HudBackdrop } from "./components/HudBackdrop";
export { MockHeader } from "./components/MockHeader";
export { LeftColumn, CenterColumn, RightColumn } from "./components/MockColumns";
export { GreetingStack } from "./components/GreetingStack";
export { OrbStage } from "./components/OrbStage";
export { VoiceWave } from "./components/VoiceWave";
export { VoiceCluster } from "./components/VoiceCluster";
export { DetailOverlay, type DetailDialogProps } from "./components/DetailOverlay";

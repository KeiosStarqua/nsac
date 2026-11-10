import type { FactId, GoToTarget, StationId } from "../sky";
import type { SourceId } from "../sources";

export interface SourceCopy {
  label: string;
  note: string;
}

export interface SkyCopy {
  /** Accessible name of the flying Sky button, per tour state. */
  startTour: string;
  stopTour: string;
  /** Slot text before Sky has landed there. */
  waiting: string;
  composing: string;
  origin: { model: string; offline: string; rejected: string };
  sourceLabel: string;
  disclaimer: string;
  facts: Record<FactId, { label: string; value: string }>;
  goTo: Record<GoToTarget, string>;
  /**
   * `brief` is what the local model is told about the place Sky landed. `preset` is an OpenUI Lang
   * program shown at once and kept when the model is offline or its output is rejected. Free text in a
   * preset never contains digits: numbers only come from `Fact`.
   */
  stations: Record<StationId, { name: string; brief: string; preset: string }>;
}

/** One typed shape for all page text, so `en` and `vi` cannot drift apart. */
export interface Copy {
  meta: { title: string; description: string };
  nav: {
    features: string;
    hazards: string;
    data: string;
    demo: string;
    concept: string;
    story: string;
    trust: string;
    sources: string;
    language: string;
    skip: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    lead: string;
    challenge: string;
    primaryCta: string;
    secondaryCta: string;
    badges: string[];
  };
  features: {
    title: string;
    lead: string;
    exampleLabel: string;
    items: { audience: string; name: string; body: string; example: string }[];
  };
  hazards: {
    title: string;
    lead: string;
    risksLabel: string;
    measuredLabel: string;
    items: { name: string; body: string; risks: string[]; measured: string[] }[];
  };
  data: {
    title: string;
    lead: string;
    collectionTitle: string;
    collection: { title: string; body: string }[];
    columns: { data: string; standard: string; context: string; requirement: string };
    rows: { data: string; standard: string; context: string; requirement?: string }[];
    note: string;
  };
  pipeline: {
    title: string;
    lead: string;
    steps: { title: string; body: string; tag: string }[];
  };
  demo: {
    title: string;
    lead: string;
    gravity: string;
    gravitySource: string;
    simulated: string;
    offline: string;
    scoreLabel: string;
    scoreRange: string;
    severity: { yellow: string; green: string };
    headline: { alert: string; confirmed: string; fastForwarded: string };
    eventsTitle: string;
    events: { when: string; text: string }[];
    afterEvents: { when: string; text: string }[];
    recommendationTitle: string;
    action: string;
    rationale: string;
    needsConfirm: string;
    confirmedLabel: string;
    confirm: string;
    fastForward: string;
    reset: string;
    linkTitle: string;
    link: { idle: string; queued: string; delivered: string };
    disclaimer: string;
    note: string;
    dayLabel: string;
    running: string;
    error: string;
    pageEyebrow: string;
  };
  demoTeaser: { title: string; lead: string; cta: string; snapshotLabel: string; unavailable: string };
  storyTeaser: { title: string; lead: string; cta: string };
  story: {
    pageTitle: string;
    pageDescription: string;
    eyebrow: string;
    tocTitle: string;
    languageNote: string;
    unavailable: string;
    next: { title: string; body: string; cta: string };
  };
  modules: {
    title: string;
    lead: string;
    workingLabel: string;
    stubLabel: string;
    working: { name: string; body: string; source?: SourceId }[];
    stubs: { name: string; body: string }[];
    landingTitle: string;
    landingBody: string;
    plannedLabel: string;
  };
  trust: {
    title: string;
    lead: string;
    items: { title: string; body: string }[];
    disclaimer: string;
  };
  earth: {
    title: string;
    lead: string;
    body: string;
    sourceLabel: string;
  };
  sources: {
    title: string;
    lead: string;
    checkedLabel: string;
    items: Record<SourceId, SourceCopy>;
  };
  footer: { line: string; license: string; synthetic: string };
  sky: SkyCopy;
}

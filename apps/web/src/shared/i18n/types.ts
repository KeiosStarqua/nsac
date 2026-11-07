import type { SourceId } from "../sources";

export interface SourceCopy {
  label: string;
  note: string;
}

/** One typed shape for all page text, so `en` and `vi` cannot drift apart. */
export interface Copy {
  meta: { title: string; description: string };
  nav: {
    concept: string;
    demo: string;
    modules: string;
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
  difference: {
    title: string;
    lead: string;
    columns: { label: string; dashboard: string; ours: string };
    rows: { label: string; dashboard: string; ours: string }[];
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
}

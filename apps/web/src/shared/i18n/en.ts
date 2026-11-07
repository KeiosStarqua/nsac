import type { Copy } from "./types";

export const en: Copy = {
  meta: {
    title: "Astronaut onboard doctor | NASA Space Apps 2026 HCMC",
    description:
      "An offline onboard health companion for astronauts: per-person baselines, one recovery action, Mars landing readiness.",
  },
  nav: {
    concept: "Concept",
    demo: "Demo",
    modules: "Modules",
    story: "Story",
    trust: "Safety",
    sources: "Sources",
    language: "Language",
    skip: "Skip to content",
  },
  hero: {
    eyebrow: "NASA Space Apps 2026 · Ho Chi Minh City",
    title: "A doctor in the cabin when Earth is 20 minutes away.",
    lead: "An offline companion that learns each astronaut's own baseline, spots drift early, and says what to do next: one recovery action, one confirmation, one report home.",
    challenge: "Challenge: Create Health Monitoring Software for Astronauts on Space Missions",
    primaryCta: "Try the demo",
    secondaryCta: "How it works",
    badges: ["Runs fully offline", "Astronaut confirms every action", "Open source, Apache-2.0"],
  },
  difference: {
    title: "Not another health dashboard",
    lead: "A dashboard shows a doctor what went wrong. This is built for the astronaut who has no doctor in the room.",
    columns: { label: "", dashboard: "Typical dashboard", ours: "Onboard doctor" },
    rows: [
      { label: "Who uses it", dashboard: "A flight surgeon on the ground", ours: "The astronaut, onboard" },
      { label: "Network", dashboard: "Needs a live link", ours: "Works with the cable unplugged" },
      { label: "Compared against", dashboard: "Population ranges", ours: "Your own baseline" },
      { label: "Output", dashboard: "Charts of what is off", ours: "One next action" },
    ],
  },
  pipeline: {
    title: "From signal to action",
    lead: "Detection is deterministic code. The language model only explains and drafts. The astronaut decides.",
    steps: [
      {
        title: "Detect",
        body: "Compare each reading with that astronaut's own baseline: median and spread, trend, change points.",
        tag: "Deterministic",
      },
      {
        title: "Connect",
        body: "Link signals across systems: a solar storm, then poor sleep, then skipped training, then heart and leg readiness falling.",
        tag: "Space weather, heart, bone and muscle",
      },
      {
        title: "Recommend",
        body: "Pick one action from the ISS Medical Checklist and explain why in plain language.",
        tag: "Local AI explains",
      },
      {
        title: "Confirm",
        body: "Nothing runs until the astronaut presses Confirm.",
        tag: "Human in the loop",
      },
      {
        title: "Report",
        body: "A PDF for the ground team is queued and delivered after the link delay.",
        tag: "20-minute delay",
      },
    ],
  },
  demo: {
    title: "Mars landing readiness",
    lead: "Day 170, two to three weeks before landing. Step through the story.",
    gravity: "The question: can the crew stand in Mars gravity, about 0.38 of Earth's?",
    gravitySource: "NASA Mars fact sheet",
    simulated: "Simulated data",
    offline: "Offline",
    scoreLabel: "Readiness",
    scoreRange: "0 to 100",
    severity: { yellow: "Yellow", green: "Green" },
    headline: {
      alert: "Readiness is below this astronaut's baseline",
      confirmed: "Action confirmed. Ground report queued.",
      fastForwarded: "Two weeks later: readiness is back up",
    },
    eventsTitle: "What the agent connected",
    events: [
      { when: "Day 156", text: "Solar storm flagged from DONKI" },
      { when: "Day 156 to 170", text: "Two weeks of skipped training" },
      { when: "Day 170", text: "Heart and leg readiness fall below baseline" },
    ],
    afterEvents: [
      { when: "Day 170", text: "Recovery session confirmed by the astronaut" },
      { when: "Day 184", text: "Recovery sessions completed, readiness back up" },
    ],
    recommendationTitle: "One recommended action",
    action: "Complete today's recovery exercise session",
    rationale:
      "Training was skipped for 14 days after a solar storm. Heart and leg readiness are below this astronaut's own baseline.",
    needsConfirm: "Requires your confirmation",
    confirmedLabel: "Confirmed",
    confirm: "Confirm",
    fastForward: "Fast-forward 2 weeks",
    reset: "Reset",
    linkTitle: "Link to Earth",
    link: {
      idle: "No report yet",
      queued: "Report queued, simulated 20-minute delay",
      delivered: "Report delivered to ground",
    },
    disclaimer: "AI-generated, not a substitute for a physician.",
    note: "Illustrative values. The app shows the formula and a source for every weight.",
    dayLabel: "Day",
    running: "Fast-forwarding to day",
    error: "The simulation stream stopped. Press Reset and try again.",
    pageEyebrow: "Interactive demo",
  },
  demoTeaser: {
    title: "See it in action",
    lead: "Day 170, two weeks of skipped training. Watch the agent connect the signals, then confirm one action yourself.",
    cta: "Open the interactive demo",
    snapshotLabel: "Server snapshot",
    unavailable: "The snapshot could not be loaded. The demo still works.",
  },
  storyTeaser: {
    title: "A story: Sky, who watches with you",
    lead: "Four crew, one outbreak in the ship's garden, and one action that only the commander can confirm. The story is written in Vietnamese.",
    cta: "Read the story",
  },
  story: {
    pageTitle: "Story | Onboard Doctor",
    pageDescription: "Sky, a fictional story that shows how the onboard doctor detects, links signals and asks the crew to confirm one action.",
    eyebrow: "Fiction",
    tocTitle: "Chapters",
    languageNote: "The story is written in Vietnamese. It is fiction: names, ship and events are invented.",
    unavailable: "The story could not be loaded.",
    next: {
      title: "Now try the real thing",
      body: "The story is fiction. The demo runs the same loop with simulated data: detect, recommend, confirm, report.",
      cta: "Open the interactive demo",
    },
  },
  modules: {
    title: "Modules",
    lead: "Three are working. Three are interfaces on the diagram, ready to plug in.",
    workingLabel: "Working",
    stubLabel: "Interface only",
    working: [
      {
        name: "Cardio",
        body: "Heart rate, HRV, blood pressure, and the left-ventricle and stroke-volume trend of the first two weeks on the ISS.",
        source: "circulation",
      },
      {
        name: "Bone and muscle",
        body: "Tracks leg readiness and prescribes the exercise dose that rebuilds it.",
      },
      {
        name: "Space weather",
        body: "Solar-storm events from DONKI, used as an input signal to the agent.",
        source: "donki",
      },
    ],
    stubs: [
      { name: "Immune and blood", body: "Plug-in point for blood counts and inflammation markers." },
      { name: "Behavior and cognition", body: "Plug-in point for sleep, mood and performance signals." },
      { name: "Environment", body: "Plug-in point for cabin air, radiation and noise." },
    ],
    landingTitle: "Landing mode",
    landingBody:
      "In the last hours before landing, guidance switches from training to safety steps, such as assisted standing.",
    plannedLabel: "Planned",
  },
  trust: {
    title: "Built to be trusted",
    lead: "Rules the whole project follows.",
    items: [
      { title: "Offline first", body: "Runs on one laptop. Pull the network cable and nothing changes." },
      {
        title: "AI does not decide alone",
        body: "Detection is deterministic. The model explains and drafts. The astronaut confirms.",
      },
      {
        title: "Every number has a source",
        body: "Thresholds and weights carry a URL in the code and on screen.",
      },
      {
        title: "No personal data",
        body: "Crew data is synthetic, generated to match ranges published in NASA OSDR studies.",
      },
    ],
    disclaimer: "AI-generated, not a substitute for a physician.",
  },
  earth: {
    title: "The same problem on Earth, in Ho Chi Minh City",
    lead: "Concept story for the pitch.",
    body: "NASA uses bed rest to study the physical changes of spaceflight. A patient who spends two weeks in a hospital bed after surgery faces a related loss of fitness. The approach carries over: compare with the person's own baseline, then prescribe a dose of exercise.",
    sourceLabel: "NASA: bed rest as a spaceflight analog",
  },
  sources: {
    title: "Sources",
    lead: "Project links were opened on 2026-10-18. Links without a date block automated checks.",
    checkedLabel: "checked",
    items: {
      osd569: { label: "OSD-569", note: "Inspiration4 complete blood count" },
      osd575: { label: "OSD-575", note: "Metabolic panel and cytokines" },
      osdrApi: { label: "OSDR data API", note: "Programmatic access to the studies" },
      donki: { label: "DONKI", note: "Space weather events" },
      issChecklist: { label: "ISS Medical Checklist (mirror)", note: "Source of recommended actions" },
      circulation: { label: "Circulation 2026", note: "Heart changes in the first two weeks on the ISS" },
      marsGravity: { label: "NASA Mars fact sheet", note: "Surface gravity, 0.38 of Earth's" },
      bedRest: { label: "NASA: bed rest as an analog", note: "Why bed rest is used to study spaceflight" },
    },
  },
  footer: {
    line: "Built for the NASA Space Apps Challenge 2026, Ho Chi Minh City. Not an official NASA product.",
    license: "Apache-2.0",
    synthetic: "Demo values are simulated and crew data is synthetic.",
  },
};

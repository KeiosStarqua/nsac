import type { Copy } from "./types";

export const en: Copy = {
  meta: {
    title: "Sky, the clinical assistant for astronauts | NASA Space Apps 2026 HCMC",
    description:
      "Sky is an offline clinical assistant for long space missions. It collects crew health data, warns astronauts and flight surgeons, and recommends one action.",
  },
  nav: {
    living: "SKY Live",
    features: "Features",
    hazards: "Hazards",
    data: "Data",
    demo: "Demo",
    concept: "Concept",
    story: "Story",
    trust: "Safety",
    sources: "Sources",
    language: "Language",
    skip: "Skip to content",
  },
  hero: {
    eyebrow: "NASA Space Apps 2026 · Ho Chi Minh City",
    title: "Meet Sky, the clinical assistant that travels with the crew.",
    lead: "On a mission to Mars there is no resupply and Earth is far away. Sky plays the role of a clinical nurse: it collects medically significant data, analyses it, and gives astronauts and flight surgeons recommendations and warnings before a problem becomes a medical event.",
    challenge: "Challenge: Create Health Monitoring Software for Astronauts on Space Missions",
    primaryCta: "Try the demo",
    secondaryCta: "See the features",
    badges: ["Runs fully offline", "Humans confirm every action", "Open source, Apache-2.0"],
  },
  features: {
    title: "Two assistants, one crew",
    lead: "Sky serves the astronaut and the flight surgeon from the same data.",
    exampleLabel: "Example",
    items: [
      {
        audience: "For astronauts",
        name: "Personal health assistant",
        body: "Sky analyses the activities and environments tied to each duty, then gives personalised suggestions that help the astronaut perform at their best. If one astronaut has a medical incident, Sky alerts every crew member so the crew can respond together.",
        example:
          "An astronaut has labor-intensive work on the celestial surface tomorrow. Sky recommends a certain supplement and enough rest to prepare.",
      },
      {
        audience: "For flight surgeons",
        name: "Clinical assistant",
        body: "Sky continuously collects medical data from the whole crew and analyses it to support diagnosis and treatment recommendations. It measures the risk of infectious disease among crew members, for each person and for the crew as a whole.",
        example:
          "An astronaut's medical log shows symptoms of influenza, so the risk of it spreading to the crew rises. Sky warns the flight surgeon and suggests quarantine. It suggests treatment to the astronaut at risk, and preventive methods and symptoms to watch for to everyone else.",
      },
    ],
  },
  hazards: {
    title: "Five hazards Sky watches for",
    lead: "NASA groups the risks of a journey to Mars into five hazards. For each one, Sky follows the signals that matter and compares them with the astronaut's own pre-flight baseline.",
    risksLabel: "Risks",
    measuredLabel: "Measured with",
    items: [
      {
        name: "Space radiation",
        body: "Cardiovascular and endothelial damage, and impaired neurogenesis.",
        risks: [
          "Arterial stiffness and early vascular aging",
          "Endothelial thickening",
          "Arrhythmias and conduction disturbances",
          "Myocardial injury",
          "Orthostatic intolerance after EVA and landing",
          "Spatial and working memory",
          "Intracranial pressure and neuro-optic stress",
          "Sleep-wake rhythm disruption",
        ],
        measured: [
          "Pulse wave velocity",
          "Carotid ultrasound",
          "Holter ECG or smart patch",
          "Point-of-care troponin, hs-CRP, IL-6",
          "Continuous blood pressure and heart rate",
          "NASA Cognition tests",
          "Optical coherence tomography",
          "fNIRS",
          "Wrist actigraphy",
        ],
      },
      {
        name: "Changes in gravity fields",
        body: "Months of weightlessness on the way, about ⅜ of Earth's gravity on Mars, then re-adaptation to Earth's gravity.",
        risks: [
          "Fluid shift and spaceflight-associated neuro-ocular syndrome",
          "Bone loss",
          "Muscle atrophy and strength loss",
          "Cardiovascular deconditioning",
          "Space motion sickness and balance problems",
        ],
        measured: [
          "Optical coherence tomography",
          "DXA or pQCT and bone-turnover markers",
          "ARED load and power tracking",
          "Ultrasound and echocardiogram",
          "Holter monitoring and blood pressure cuffs",
          "Neurobehavioral tests and gait assessment",
        ],
      },
      {
        name: "Isolation and confinement",
        body: "A small crew, far from home, for a long time.",
        risks: ["Sleep loss", "Circadian desynchronization", "Work overload"],
        measured: [
          "Wrist actigraphy and sleep logs",
          "Psychomotor vigilance task",
          "Melatonin and cortisol rhythms",
          "Core body temperature",
          "NASA Task Load Index",
          "Mood logs and voice stress analysis",
        ],
      },
      {
        name: "Hostile and closed environments",
        body: "The ecosystem inside the spacecraft shapes the crew's microbes, immune system and hormones.",
        risks: [
          "Altered gut, skin and mucosal microbiome",
          "Immune dysregulation and viral reactivation",
          "Endocrine disruption",
        ],
        measured: [
          "Onboard metagenomic sequencing",
          "Fecal calprotectin and plasma zonulin",
          "Viral DNA load by PCR",
          "Cytokine panels",
          "Salivary and plasma endocrine panels",
        ],
      },
      {
        name: "Distance from Earth",
        body: "The trip to Mars takes 7 to 10 months and there is no resupply. The crew depends on careful planning and its own self-sufficiency, which is why Sky works without a link to Earth.",
        risks: [],
        measured: [],
      },
    ],
  },
  data: {
    title: "The data Sky needs, and the standard it is checked against",
    lead: "Limits below come from NASA-STD-3001 Volume 1 Rev B (Crew Health). Every requirement links to the same document.",
    collectionTitle: "How Sky gets its data",
    collection: [
      {
        title: "Automatically",
        body: "Machines and tools on board synchronise their measurements with Sky, for example exercise equipment and wearables.",
      },
      {
        title: "By asking",
        body: "When a measurement has no machine, Sky prompts the astronaut for a manual entry, such as a symptom or a meal.",
      },
    ],
    columns: { data: "Data", standard: "Standard", context: "Context", requirement: "Requirement" },
    rows: [
      {
        data: "Maximum aerobic capacity (VO2max)",
        standard: "At least 32.9 ml·min⁻¹·kg⁻¹",
        context: "Missions with microgravity EVA",
        requirement: "V1 4001",
      },
      {
        data: "Maximum aerobic capacity (VO2max)",
        standard: "At least 36.5 ml·min⁻¹·kg⁻¹",
        context: "Missions with celestial surface EVA",
        requirement: "V1 4002",
      },
      {
        data: "Nutrient intake",
        standard:
          "At least 90% of the calculated requirement, from age, sex, body mass, height and an activity factor of 1.25",
        context: "In mission",
        requirement: "V1 4020",
      },
      {
        data: "Skeletal muscle strength",
        standard: "At least 80% of baseline",
        context: "In mission",
        requirement: "V1 4024",
      },
      {
        data: "Bone mass",
        standard: "Hip and spine at least 95% of pre-mission values, femoral neck at least 90%",
        context: "Not measurable in flight. Sky estimates it from exercise duration and medicine intake.",
        requirement: "V1 4027",
      },
      {
        data: "Total radiation exposure",
        standard: "Below 600 mSv",
        context: "Whole career",
        requirement: "V1 4030",
      },
      {
        data: "Short-term radiation exposure",
        standard: "Below 250 mSv",
        context: "Solar particle events",
        requirement: "V1 4031",
      },
      {
        data: "Short-term radiation exposure",
        standard: "Below 20 mSv per mission year",
        context: "Nuclear technologies, such as radioisotope power systems and fission reactors",
        requirement: "V1 4032",
      },
      {
        data: "Fitness-for-duty sensorimotor",
        standard: "Operationally defined",
        context: "Depends on the mission",
      },
      {
        data: "Behavioral health and cognition",
        standard: "Behavioral health evaluation",
        context: "In mission",
      },
      {
        data: "Hematology and immunology",
        standard: "Stay inside accepted critical values",
        context: "In mission",
      },
    ],
    note: "Other thresholds Sky uses, such as limits per hazard, are personal-baseline rules that carry their own source in the app.",
  },
  pipeline: {
    title: "From signal to action",
    lead: "Detection is deterministic code. The language model only explains and drafts. The people on board decide.",
    steps: [
      {
        title: "Collect",
        body: "Gather data from synchronised machines and tools, or ask the astronaut for a manual entry.",
        tag: "Automatic or by asking",
      },
      {
        title: "Detect",
        body: "Compare each reading with that astronaut's own baseline: median and spread, trend, change points.",
        tag: "Deterministic",
      },
      {
        title: "Recommend",
        body: "Link signals across systems, pick one action from the ISS Medical Checklist, and explain why in plain language. Warn the flight surgeon and the crew when risk is shared.",
        tag: "Explained on device",
      },
      {
        title: "Confirm",
        body: "Nothing runs until a person presses Confirm.",
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
    disclaimer: "Machine-generated, not a substitute for a physician.",
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
    pageTitle: "Story | Sky",
    pageDescription: "A fictional story that shows how Sky detects, links signals and asks the crew to confirm one action.",
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
        title: "SKY does not decide alone",
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
    disclaimer: "Machine-generated, not a substitute for a physician.",
  },
  earth: {
    title: "The same problem on Earth, in Ho Chi Minh City",
    lead: "Concept story for the pitch.",
    body: "NASA uses bed rest to study the physical changes of spaceflight. A patient who spends two weeks in a hospital bed after surgery faces a related loss of fitness. The approach carries over: compare with the person's own baseline, then prescribe a dose of exercise.",
    sourceLabel: "NASA: bed rest as a spaceflight analog",
  },
  sources: {
    title: "Sources",
    lead: "Each link shows the date it was last opened. Links without a date block automated checks.",
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
      fiveHazards: { label: "NASA: five hazards of human spaceflight", note: "Why Sky groups risks into five hazards" },
      nasaStd3001: { label: "NASA-STD-3001 Vol. 1 Rev B", note: "Crew health limits in the data table" },
    },
  },
  footer: {
    line: "Built for the NASA Space Apps Challenge 2026, Ho Chi Minh City. Not an official NASA product.",
    license: "Apache-2.0",
    synthetic: "Demo values are simulated and crew data is synthetic.",
  },
  sky: {
    startTour: "Sky: start the guided tour",
    stopTour: "Sky: stop the guided tour",
    ask: {
      openLabel: "Ask Sky to compose this panel",
      closeLabel: "Close the Ask Sky panel",
      placeholder: "Ask Sky…",
      submitLabel: "Ask Sky",
      answering: "Answering about",
    },
    waiting: "Sky will stop here.",
    composing: "Sky is composing this panel…",
    origin: {
      model: "Composed by the model",
      offline: "The model could not run, built-in panel shown",
      rejected: "The model's panel broke a safety rule, built-in panel shown",
    },
    keyDialog: {
      title: "Sky needs an OpenRouter key",
      cardTitle: "One key and I compose the panels",
      body: "I compose these panels with a model on OpenRouter. Paste your key: it stays on this laptop, is never logged and never shown again.",
      fieldLabel: "OpenRouter API key",
      saveLabel: "Save key",
      note: "Create a key at openrouter.ai/keys. Stored on this laptop only, never logged, never shown again.",
      keepPreset: "Keep the built-in panel",
      errorInvalid: "That does not look like an OpenRouter key — check it and try again.",
      errorIo: "Could not save the key on this machine. Try again.",
      fixKey: "Set the OpenRouter key…",
    },
    sourceLabel: "Source",
    disclaimer: "Machine-generated, not a substitute for a physician.",
    stepsLabel: "What happens next",
    facts: {
      tripLength: { label: "Trip to Mars", value: "7 to 10 months" },
      marsGravity: { label: "Surface gravity on Mars", value: "0.38 of Earth's" },
      radiationCareer: { label: "Total radiation exposure, whole career", value: "Below 600 mSv" },
      radiationSolar: { label: "Short-term exposure, solar particle events", value: "Below 250 mSv" },
      muscleStrength: { label: "Skeletal muscle strength in mission", value: "At least 80% of baseline" },
      aerobicSurface: { label: "VO2max for celestial surface EVA", value: "At least 36.5 ml·min⁻¹·kg⁻¹" },
    },
    goTo: {
      demo: "Open the interactive demo",
      story: "Read the story",
      concept: "Read the full concept",
      hazards: "See the five hazards",
      data: "See the data table",
      sources: "See every source",
    },
    stations: {
      console: {
        name: "Console",
        brief:
          "The visitor opened the Sky console, the app itself. Show what Sky holds for the crew: the trip it watches over, the limits it checks against, and the way out to the interactive demo. Keep it short and operational.",
        preset: `root = Console("Sky console", [crew, limits, loop])
crew = Card("Who Sky watches over", [badge, say, trip])
badge = Badge("Offline first", "info")
say = Say("I compare every astronaut with their own baseline, then I draft one action for a person to confirm.")
trip = Fact("tripLength")
limits = Card("What the crew keeps", [gravity, muscle])
gravity = Fact("marsGravity")
muscle = Fact("muscleStrength")
loop = Card("See the loop", [steps, note, next])
steps = Steps(["I notice a change against your own baseline", "I link it to the other signals", "I draft one action from the checklist", "You press Confirm, then the report goes to the ground"])
note = Alert("caution", "Nothing runs until a person presses Confirm.")
next = GoTo("demo")`,
      },
      welcome: {
        name: "Welcome",
        brief:
          "The visitor is reading the concept page. Introduce Sky: an offline clinical assistant that compares each astronaut with their own baseline and suggests one action that a person confirms.",
        preset: `root = Console("Sky", [card])
card = Card("I fly with the crew", [say, trip, gravity, next])
say = Say("I travel with the crew and compare each person with their own baseline. Scroll, and I will follow you.")
trip = Fact("tripLength")
gravity = Fact("marsGravity")
next = GoTo("demo")`,
      },
      hazards: {
        name: "Hazards",
        brief:
          "The visitor is reading the five hazards of a Mars mission: radiation, gravity changes, isolation, a closed environment, distance from Earth. Explain which signals Sky watches for radiation and why it uses space weather alerts.",
        preset: `root = Console("What I watch on the way", [card])
card = Card("The hazard nobody feels", [say, career, solar, note])
say = Say("Radiation is the hazard nobody feels, so I pair the dose limits with space weather alerts from DONKI.")
career = Fact("radiationCareer")
solar = Fact("radiationSolar")
note = Alert("info", "These are NASA limits. I follow the trend for each person, I do not diagnose.")`,
      },
      data: {
        name: "Data",
        brief:
          "The visitor is reading how Sky collects data (automatically from machines, or by asking the astronaut) and the NASA-STD-3001 limits it checks against.",
        preset: `root = Console("Checked against the standard", [card])
card = Card("Measured, or asked", [say, muscle, aerobic, next])
say = Say("When no machine can measure something, I ask you. Then I check it against NASA's crew health standard.")
muscle = Fact("muscleStrength")
aerobic = Fact("aerobicSurface")
next = GoTo("sources")`,
      },
      pipeline: {
        name: "Signal to action",
        brief:
          "The visitor is reading the loop: collect, detect with deterministic code, recommend one action from the ISS Medical Checklist, confirm by a person, report to the ground after the link delay.",
        preset: `root = Console("How I hand you one action", [card])
card = Card("Plain code first, model second", [say, steps, note])
say = Say("My detection is plain code. I only explain and draft.")
steps = Steps(["I notice a change against your own baseline", "I link it to other signals", "I suggest one action from the checklist", "You press Confirm, then the report goes to the ground"])
note = Alert("caution", "Nothing runs until a person presses Confirm.")`,
      },
      readiness: {
        name: "Landing readiness",
        brief:
          "The visitor is on the interactive demo, a few weeks before landing on Mars. A solar storm led to two weeks of skipped training and readiness fell below baseline. Sky proposes a recovery session; the visitor must press Confirm. Values are simulated.",
        preset: `root = Console("Getting ready to stand on Mars", [card])
card = Card("Readiness after the storm", [say, gravity, muscle, note])
say = Say("Two weeks of skipped training pulled readiness down. A recovery session each day brings it back.")
gravity = Fact("marsGravity")
muscle = Fact("muscleStrength")
note = Alert("caution", "The score here is simulated. You press Confirm, I never do it for you.")`,
      },
      story: {
        name: "Story",
        brief:
          "The visitor opened the fictional story, written in Vietnamese. Four crew members each have a Sky; an outbreak starts in the ship's garden and the Skys link the signals across the crew.",
        preset: `root = Console("A story about us", [card])
card = Card("When the crew turns yellow together", [say, trip, next])
say = Say("This story is fiction. It shows what the Skys do when most of the crew turn yellow in the same week.")
trip = Fact("tripLength")
next = GoTo("demo")`,
      },
    },
  },
};

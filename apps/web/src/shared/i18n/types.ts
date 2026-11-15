export interface Copy {
  meta: { title: string; description: string };
  /** Crew selection (mock astronaut picker). `{name}` is replaced at render time. */
  astronaut: {
    eyebrow: string;
    title: string;
    subtitle: string;
    status: string;
    confirm: string;
    greeting: string;
    change: string;
    hint: string;
    footer: string;
    close: string;
    /** Badge on a card another session already claimed. */
    taken: string;
    /** Confirm-button label while the selected card is taken by another session. */
    takenCta: string;
    /** Inline error after a failed claim (someone else won the race). */
    claimTaken: string;
    /** Confirm-button label while the claim request is in flight. */
    claiming: string;
    /** Tertiary button that drops every pick (force release / epoch reset). */
    forceRelease: string;
    /** Inline confirm line before the release runs. */
    forceReleaseConfirm: string;
    /** Confirm action of the inline 2-step confirm. */
    forceReleaseConfirmAction: string;
    /** Cancel action of the inline 2-step confirm. */
    forceReleaseCancel: string;
    /** Inline error when the release request failed. */
    forceReleaseFailed: string;
  };
  chat: {
    label: string;
    placeholder: string;
    send: string;
    close: string;
    thinking: string;
    roleYou: string;
    roleSky: string;
    emptyHint: string;
    selectFirst: string;
    missingKey: string;
    timeout: string;
    unavailable: string;
    footer: string;
    /** `/` chat overlay header (`features/sky-hud/components/SkyChatPanel.tsx`). */
    title: string;
    /** `/` chat overlay subtitle — what the person can ask about. */
    subtitle: string;
    /** Card header of the `/` chat card — one line, no crew suffix. */
    panelTitle: string;
    /** Footer pill that closes the card and starts the microphone instead. */
    useVoice: string;
    /** Keyboard hint beside the send button. */
    enterToSend: string;
    emptyTitle: string;
    emptyDescription: string;
    /** Body of the pending trace row under `thinking`. */
    thinkingDetail: string;
    /** Header toggle: Sky speaks chat replies (Volume2/VolumeX). */
    voiceToggle: string;
    /** Aria label / title when the toggle is on. */
    voiceOn: string;
    /** Aria label / title when the toggle is off. */
    voiceOff: string;
  };
  /** ≤480px watch layout: crew chip, tile labels, pager screens, tiny print. */
  watch: {
    simulated: string;
    selectCrew: string;
    vitalHeart: string;
    vitalSpo2: string;
    vitalResp: string;
    vitalSleep: string;
    typeInstead: string;
    demonstrationOnly: string;
    /** Swipe pager — aria labels for the three pages (also the dot labels). */
    screenVitals: string;
    screenWellness: string;
    screenSky: string;
    /** Swipe pager — chevron buttons paging backwards/forwards. */
    screenPrevious: string;
    screenNext: string;
    /** Wellness screen — full-width button opening the shared health detail dialog. */
    viewDetails: string;
    /** Sky screen — micro-caption above the dictation button. */
    speakToSky: string;
  };
  /** `/` — the declarative OpenUI HUD (default; `?gen=0` opts out to the staged HUD). Every string the HUD shows lives here. */
  hud: {
    tagline: string;
    brandAria: string;
    missionAria: string;
    vitalsAria: string;
    conversationAria: string;
    healthAria: string;
    hologramAria: string;
    wellnessAria: string;
    wellnessLabel: string;
    wellnessStatus: string;
    wellnessGuidance: string;
    wellnessDemo: string;
    typeInsteadAria: string;
    /** Accessible name of the listening bar's stop control. */
    stopListening: string;
    /** The open question under the greeting (HUD prompt) before a reply replaces it. */
    promptFallback: string;
    /** Chrome chip — navigates between the console (`/`) and watch (`/watch`) views. */
    deviceSwitcher: string;
    deviceConsole: string;
    deviceWatch: string;
    /** Caption under the watch device frame — labels it as a live demonstration. */
    watchCaption: string;
    /** Header chrome chip linking to the `/spacecraft` cinematic ISS 3D view. */
    spacecraftButton: string;
    spacecraftButtonAria: string;
    captionsListening: string;
    captionsError: string;
    greetingFallback: string;
    composeHint: string;
    composeHintDismissAria: string;
    /** Chat-composed program on the declarative `/` HUD: chip that restores Sky's own view. */
    chatOverrideBack: string;
  };
  /**
   * `/` default — the "SKY · Astronaut Wellness" mock console (`features/hud-mock`). Every number it
   * shows is simulated (fixture `features/hud-mock/model/fixture.ts`); units stay English by design.
   * `?gen=0` still renders the staged screen and `?arch=openui` the declarative hud-gen tree.
   */
  hudMock: {
    profileTitle: string;
    profileSimulated: string;
    /** `{name}` = the followed astronaut. */
    avatarAlt: string;
    /** Roster role labels — the fixture/backend role string maps onto one of these. */
    roles: {
      commander: string;
      flightEngineer: string;
      medicalOfficer: string;
      missionSpecialist: string;
      payloadSpecialist: string;
    };
    vitalsTitle: string;
    vitalsNow: string;
    vitalHeartRate: string;
    vitalBloodPressure: string;
    vitalRespiratoryRate: string;
    vitalBloodOxygen: string;
    vitalBodyTemperature: string;
    vitalsAria: string;
    trendsTitle: string;
    trendsLast24h: string;
    trendHeartRate: string;
    trendSleep: string;
    trendActivity: string;
    /** `{value}` = the trailing average. */
    trendAvg: string;
    trendsAria: string;
    readinessTitle: string;
    readinessStatus: string;
    readinessStable: string;
    readinessGuidance: string;
    /** `{score}` = the ring's 0–100 value. */
    readinessScoreAria: string;
    /** `{value}` = the small secondary 0–100 value beside the ring. */
    readinessSupportAria: string;
    readinessAria: string;
    tabsAria: string;
    tabs: { body: string; recovery: string; cognitive: string; energy: string };
    panelBody: string;
    panelRecovery: string;
    panelCognitive: string;
    panelEnergy: string;
    /** Row labels of the four readiness tab panels. */
    metricBodyWeight: string;
    metricMuscleMass: string;
    metricBoneMineral: string;
    metricBodyFat: string;
    metricSleepDuration: string;
    metricSleepEfficiency: string;
    metricHrv: string;
    metricFatigue: string;
    metricReactionTime: string;
    metricMathAccuracy: string;
    metricMood: string;
    metricAttention: string;
    metricEnergyBurned: string;
    metricEnergyIntake: string;
    metricEnergyBalance: string;
    metricActivity: string;
    fatigueLow: string;
    attentionNormal: string;
    /** `{balance}` = the signed kcal balance, e.g. "+180". */
    balanceCaption: string;
    cardActivity: string;
    cardEnergyBurned: string;
    cardEnergyIntake: string;
    cardActivityDeltaCaption: string;
    cardsAria: string;
    /** `{sleep}` = duration, `{efficiency}` = percent. Deterministic, no LLM. */
    insightText: string;
    insightKicker: string;
    insightOpen: string;
    simulatedCrew: string;
    bodyHoloAria: string;
    /** Accessible name of the Body-tab hologram button that opens `/body`. */
    bodyHoloOpen: string;
    /** Accessible name of the detail dialog's close button. */
    detailClose: string;
    /** Speech Engine voice chat (`/` only): the hint line under the mic control. */
    voiceConnecting: string;
    voiceListening: string;
    voiceSpeaking: string;
    /** Backend has no `ELEVENLABS_SPEECH_ENGINE_ID` — shown instead of starting the conversation. */
    voiceNotConfigured: string;
    /** Register/config/start failed — the conversation never began (or dropped). */
    voiceFailed: string;
  };
  /** `/performance` — SKY / Human Performance, the fitness-style 12-metric demo face. */
  performance: {
    metaTitle: string;
    brand: string;
    brandSub: string;
    brandAria: string;
    /** Header right block. `{day}` is the simulated mission day. */
    crewHealth: string;
    missionDay: string;
    simulatedData: string;
    /** The small chip every tile carries. */
    simulatedTag: string;
    backToHud: string;
    bodyMap: string;
    /** Small tertiary footer link to `/research`. */
    researchEvidence: string;
    metricsAria: string;
    /** Caption under every delta. */
    deltaVs: string;
    insightTitle: string;
    insightCaption: string;
    insightSource: string;
    insightMuscle: string;
    insightSleep: string;
    insightHrv: string;
    insightHydration: string;
    insightSteady: string;
    methodTitle: string;
    methodNote: string;
    methodEstimated: string;
    methodMeasured: string;
    methodSelfReported: string;
    methodSimulated: string;
    /** Quiet footnote when the backend could not be read. */
    fallbackNote: string;
    /** Quiet footnote when the backend answered. `{asOf}` is its timestamp. */
    reachableNote: string;
    disclaimer: string;
    metricEnergyBurned: string;
    metricCaloriesIntake: string;
    metricEnergyBalance: string;
    metricMuscleMass: string;
    metricMuscleStrength: string;
    metricBodyFat: string;
    metricSleepDuration: string;
    metricSleepEfficiency: string;
    metricHrv: string;
    metricHydration: string;
    metricExerciseDuration: string;
    metricHeartRate: string;
  };
  /** `/research` — SKY / Research Evidence, read-only view of the NASA analog cohort datasets in the `data/` submodule. Analog research, never the fictional crew. */
  research: {
    metaTitle: string;
    brand: string;
    brandSub: string;
    backToHud: string;
    backPerformance: string;
    /** Mono badge chip in the header. */
    badge: string;
    /** Header context line naming the analog cohorts. */
    contextLine: string;
    /** Header line: research data, not this crew, not clinical guidance. */
    disclaimerLine: string;
    /** Plain-text legend above the grid explaining the two stat kinds. */
    legend: string;
    groups: {
      cardiometabolic: string;
      musculoskeletal: string;
      neuro: string;
      sleepBehavior: string;
      fitnessDose: string;
    };
    /** Card titles stay Vietnamese, with the English metric name beneath; both locales render the same pair. Keys are the task ids. */
    cards: {
      lv_mass: { title: string; subtitle: string };
      lv_diastolic_volume: { title: string; subtitle: string };
      lipid_ldl: { title: string; subtitle: string };
      glucose: { title: string; subtitle: string };
      vitals_sbp: { title: string; subtitle: string };
      vitals_dbp: { title: string; subtitle: string };
      vitals_pulse: { title: string; subtitle: string };
      vitals_temp: { title: string; subtitle: string };
      vitals_weight: { title: string; subtitle: string };
      hr: { title: string; subtitle: string };
      bone_mineral: { title: string; subtitle: string };
      lean_mass_legs: { title: string; subtitle: string };
      muscle_quadriceps: { title: string; subtitle: string };
      muscle_soleus: { title: string; subtitle: string };
      cognition_cpt_rt: { title: string; subtitle: string };
      cognition_math_acc: { title: string; subtitle: string };
      sleep_act: { title: string; subtitle: string };
      sleep_act_duration: { title: string; subtitle: string };
      fatigue: { title: string; subtitle: string };
      mood: { title: string; subtitle: string };
      cpet: { title: string; subtitle: string };
      dose: { title: string; subtitle: string };
    };
    /** Stat-kind chip: distribution across overlapping windows. */
    statWindow: string;
    /** Stat-kind chip: Day-0→Day-70 change vs baseline. */
    statDelta: string;
    rowsLabel: string;
    subjectsLabel: string;
    medianLabel: string;
    iqrLabel: string;
    rangeLabel: string;
    /** Link label to the per-task data card on GitHub. */
    dataCard: string;
    /** Line on every card: analog cohort research, not this crew. */
    notThisCrew: string;
    provenanceTitle: string;
    provenanceBody: string;
    provenanceCatalog: string;
    provenancePipeline: string;
    /** Licence line listing the analog source licences + the repo licence. */
    provenanceLicences: string;
    /** Shown when the bundled research data fails zod validation. */
    emptyState: string;
    disclaimer: string;
    notMedicalAdvice: string;
  };
  /** `/health` — agent configuration readiness (no secrets). Check labels come from the server; this is the page chrome + live probes. */
  health: {
    title: string;
    subtitle: string;
    /** Table headers. */
    colCheck: string;
    colStatus: string;
    colDetail: string;
    colHint: string;
    liveTitle: string;
    /** Live probe sections; provider id is appended. */
    liveKey: string;
    credits: string;
    limit: string;
    modelLine: string;
    runLive: string;
    running: string;
    copyDiag: string;
    rosterTitle: string;
    colId: string;
    colName: string;
    colRole: string;
    colModel: string;
    colKey: string;
    colProvider: string;
    fixTitle: string;
    fixBox: string;
    fixLocal: string;
  };
  /** Hidden /admin page — operator-only model switch. */
  admin: {
    title: string;
    notConfigured: string;
    checking: string;
    unlockTitle: string;
    keyLabel: string;
    unlock: string;
    unlocking: string;
    denied: string;
    currentEffective: string;
    backendSetting: string;
    envFallback: string;
    appliesNote: string;
    apply: string;
    applying: string;
    saved: string;
    applyFailed: string;
    invalidModel: string;
    catalogUnavailable: string;
    backendError: string;
    unauthorized: string;
    catalogError: string;
    /** Provider picker — two providers, Go default. */
    providerLabel: string;
    providerOpencodeGo: string;
    providerOpencodeGoDesc: string;
    providerOpenrouter: string;
    providerOpenrouterDesc: string;
    /** One line kept for the legacy OpenRouter branch. */
    legacyNote: string;
    providerAmazonBedrock: string;
    providerAmazonBedrockDesc: string;
    /** Bedrock verified footer note — deliberately identical in en/vi (untranslated). */
    bedrockVerifiedNote: string;
    /** "Default (all agents)" dropdown + the unset option. */
    defaultAllLabel: string;
    defaultAllHint: string;
    inheritDefault: string;
    /** First option of every per-profile dropdown. */
    inheritProfile: string;
    profileChatLabel: string;
    profileChatHint: string;
    profileOrchestratorLabel: string;
    profileOrchestratorHint: string;
    profileGenerativeUiLabel: string;
    profileGenerativeUiHint: string;
    profileHudComposerLabel: string;
    profileHudComposerHint: string;
    /** Provider + effective model of the Default dropdown, shown after Apply/load. */
    effectiveLine: string;
    resetClaims: string;
    resetClaimsConfirm: string;
    resetting: string;
    resetClaimsDone: string;
    resetClaimsFailed: string;
    /** ElevenLabs panel — Sky speaks chat replies (key is write-only, never rendered). */
    elevenlabsTitle: string;
    elevenlabsConfigured: string;
    elevenlabsNotConfigured: string;
    elevenlabsKeyLabel: string;
    elevenlabsSave: string;
    elevenlabsSaving: string;
    elevenlabsSaved: string;
    elevenlabsSaveFailed: string;
    elevenlabsInvalidKey: string;
    /** Clear button label; the action needs the inline 2-step confirm. */
    elevenlabsClear: string;
    elevenlabsClearConfirm: string;
    elevenlabsClearCancel: string;
    elevenlabsClearing: string;
    elevenlabsClearDone: string;
    elevenlabsClearFailed: string;
    /** Note under the panel: write-only semantics. */
    elevenlabsNote: string;
  };
}

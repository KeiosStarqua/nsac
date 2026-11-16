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
  /** `/` — the console HUD (`?arch=openui` declarative tree, `/watch` shared strings). Every string the HUD shows lives here. */
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
    /** Chrome chip — switches the locale (`?lang=en|vi` on the same route). */
    langSwitcher: string;
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
   * `?arch=openui` renders the declarative hud-gen tree instead.
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
    bodyHoloAria: string;
    /** Accessible name of the Body-tab hologram button that opens `/body`. */
    bodyHoloOpen: string;
    /** Accessible name of the detail dialog's close button. */
    detailClose: string;
    /** Speech Engine voice chat (`/` only): the hint line under the mic control. */
    voiceConnecting: string;
    voiceListening: string;
    voiceSpeaking: string;
    /** Live session, user turn finished, Sky is composing its spoken answer. */
    voiceThinking: string;
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
  /**
   * Live health strip (`/performance`) — the simulated habitat feed from
   * `/api/health/live/:astronautId`, labelled LIVE / HISTORICAL / OFFLINE. Never a clinical reading.
   */
  live: {
    /** Accessible name of the strip region. */
    stripAria: string;
    visibleLive: string;
    historicalLabel: string;
    offlineLabel: string;
    /** `{time}` = `HH:MM UTC`. */
    lastUpdated: string;
    metricHeartRate: string;
    metricSpo2: string;
    metricRespiratoryRate: string;
    metricCoreTemperature: string;
    metricBloodPressure: string;
    metricActivity: string;
  };
  /** `/performance` — Clinical findings panel (simulated, AI assists review only). */
  clinical: {
    title: string;
    disclaimerLine: string;
    empty: string;
    unavailable: string;
    markReviewed: string;
    markReviewedAria: string;
    resolve: string;
    resolveAria: string;
    reviewPill: string;
    reviewedPill: string;
    methodLink: string;
    askOfficer: string;
    officerLoading: string;
    officerPiSdk: string;
    officerDeterministic: string;
    officerRequiresReview: string;
    officerError: string;
    officerRetry: string;
    actionFailed: string;
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
    /** OpenCode Go key source line under the table. */
    goKeyEnv: string;
    /** `{at}` is an ISO-ish UTC timestamp of the stored file. */
    goKeyStored: string;
    goKeyMissing: string;
    fixTitle: string;
    fixBox: string;
    fixLocal: string;
  };
  /** Hidden /admin page — operator-only model switch. */
  admin: {
    title: string;
    /** One-line orientation under the header (what this page is, write-only semantics). */
    pageDescription: string;
    /** Lock button in the header — clears the session cookie and returns to the unlock screen. */
    lock: string;
    notConfigured: string;
    checking: string;
    unlockTitle: string;
    /** Explanation inside the unlock card — where SKY_ADMIN_KEY lives and how long the session lasts. */
    unlockDescription: string;
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
    /** Section title of the Agent models card — `{provider}` is the display name. */
    modelsSectionKicker: string;
    /** Shown in the Provider card when Bedrock is selected — where the token is configured. */
    bedrockKeyNote: string;
    /** Caption above the default-model select — `{provider}` is the display name. */
    catalogScopedNote: string;
    /** Inline notice after a provider switch dropped foreign-provider picks — `{count}`. */
    modelsDroppedForeign: string;
    resetClaims: string;
    resetClaimsConfirm: string;
    resetting: string;
    resetClaimsDone: string;
    resetClaimsFailed: string;
    /** Intro line on the API Keys tab — write-only semantics, env precedence. */
    keysIntro: string;
    /** Explanation on the Reset claims card — what a claim is and what reset clears. */
    claimsDescription: string;
    /** AWS Bedrock panel — bearer token is write-only, region pinned to ap-southeast-1. */
    bedrockTitle: string;
    bedrockConfiguredEnv: string;
    bedrockConfiguredFile: string;
    bedrockNotConfigured: string;
    /** Hint shown when the token comes from the environment (env wins over the stored file). */
    bedrockEnvHint: string;
    bedrockTokenLabel: string;
    bedrockPlaceholder: string;
    /** Placeholder while a stored token exists — the token itself is never shown. */
    bedrockPlaceholderStored: string;
    bedrockSave: string;
    bedrockSaving: string;
    bedrockSaved: string;
    bedrockSaveFailed: string;
    bedrockInvalidKey: string;
    /** Clear button label; the action needs the inline 2-step confirm. */
    bedrockClear: string;
    bedrockClearConfirm: string;
    bedrockClearCancel: string;
    bedrockClearing: string;
    bedrockClearDone: string;
    bedrockClearFailed: string;
    /** Note under the panel: write-only semantics + when the stored token is used. */
    bedrockNote: string;
    /** Read-only region line — the region is not configurable from the UI by design. */
    bedrockRegionLabel: string;
    /** Label of the read-only "where to switch provider" hint row. */
    bedrockProviderHintLabel: string;
    /** Points the operator at the Models tab to actually use the token. */
    bedrockProviderHint: string;
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
    /** OpenCode Go key panel — write-only; stored on the server, never shown again. */
    goKeyTitle: string;
    goKeyConfiguredEnv: string;
    goKeyConfiguredFile: string;
    goKeyNotConfigured: string;
    /** Hint shown when the key comes from the environment (env wins over the stored file). */
    goKeyEnvHint: string;
    goKeyLabel: string;
    goKeyPlaceholder: string;
    /** Placeholder while a stored key exists — the key itself is never shown. */
    goKeyPlaceholderStored: string;
    goKeySave: string;
    goKeySaving: string;
    goKeySaved: string;
    goKeySaveFailed: string;
    goKeyInvalidKey: string;
    /** Clear button label; the action needs the inline 2-step confirm. */
    goKeyClear: string;
    goKeyClearConfirm: string;
    goKeyClearCancel: string;
    goKeyClearing: string;
    goKeyClearDone: string;
    goKeyClearFailed: string;
    /** Note under the panel: write-only semantics + when the stored key is used. */
    goKeyNote: string;
    /** Speech Engine panel — manage the ElevenLabs Speech Engine instance behind the / mic voice chat. */
    speech: {
      title: string;
      statusConnected: string;
      statusNotConfigured: string;
      engineIdLabel: string;
      engineIdMissing: string;
      sourceLabel: string;
      sourceEnv: string;
      sourceDb: string;
      wsRunning: string;
      wsStopped: string;
      portLabel: string;
      envShadowWarning: string;
      lastErrorLabel: string;
      apiKeyLabel: string;
      apiKeyConfigured: string;
      apiKeyMissing: string;
      apiKeyHint: string;
      probe: string;
      probing: string;
      probeOk: string;
      probeFailed: string;
      create: string;
      creating: string;
      /** Technical constants (name + wsUrl) — identical in en/vi. */
      createSubline: string;
      createConfirm: string;
      createDisabledNoKey: string;
      createDone: string;
      createEnvShadowNote: string;
      wsToggleStop: string;
      wsToggleStart: string;
      wsWorking: string;
      wsToggleDone: string;
      delete: string;
      deleting: string;
      /** `{id}` is the effective engine id, substituted in the component. */
      deleteConfirm: string;
      deleteDone: string;
      backendDown: string;
      retry: string;
      genericError: string;
    };
    /** Tab labels for the seven /admin sections. */
    tabModels: string;
    /** API Keys — OpenCode Go + AWS Bedrock + ElevenLabs in one tab. */
    tabKeys: string;
    tabSpeech: string;
    tabClaims: string;
    tabBackground: string;
    tabUi: string;
    /** Agent Core — the pi | mastra switch (dual-core, HARNESSING §18). */
    tabCore: string;
    /** aria-label of the tablist above the seven sections. */
    tabsLabel: string;
    /** Background tab (`/admin/background`) — the `/` backdrop picker. */
    backgroundTitle: string;
    backgroundDescription: string;
    backgroundCurrent: string;
    backgroundNotConfigured: string;
    backgroundUpdated: string;
    backgroundParticles: string;
    backgroundParticlesDesc: string;
    backgroundGalaxy: string;
    backgroundGalaxyDesc: string;
    backgroundApply: string;
    backgroundApplying: string;
    backgroundSaved: string;
    backgroundSaveFailed: string;
    backgroundInvalid: string;
    backgroundLoadFailed: string;
    backgroundNote: string;
    /** UI tab (`/admin/ui`) — which console `/` serves. */
    uiTitle: string;
    uiDescription: string;
    uiNotConfigured: string;
    uiInvalid: string;
    uiNote: string;
    hubMock: string;
    hubMockDesc: string;
    hubGen: string;
    hubGenDesc: string;
    /** Agent Core tab (`/admin/core`) — the pi | mastra runtime switch. */
    coreTitle: string;
    coreDescription: string;
    coreCurrent: string;
    coreNotConfigured: string;
    coreUpdated: string;
    corePi: string;
    corePiDesc: string;
    coreMastra: string;
    coreMastraDesc: string;
    coreApply: string;
    coreApplying: string;
    coreSaved: string;
    coreSaveFailed: string;
    coreInvalid: string;
    coreLoadFailed: string;
    coreNote: string;
  };
}

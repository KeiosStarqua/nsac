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
  };
  /** ≤480px watch layout: crew chip, tile labels, tiny print. */
  watch: {
    simulated: string;
    selectCrew: string;
    vitalHeart: string;
    vitalSpo2: string;
    vitalResp: string;
    vitalSleep: string;
    typeInstead: string;
    demonstrationOnly: string;
  };
  /** `/?gen=1` — the declarative OpenUI HUD. Every string the HUD shows lives here. */
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
    captionsListening: string;
    captionsError: string;
    greetingFallback: string;
    composeHint: string;
    composeHintDismissAria: string;
  };
}

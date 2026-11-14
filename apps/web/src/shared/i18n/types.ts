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
}

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

import { GREETING, GREETING_STACK, PROMPT } from "../mock-classes";

export interface GreetingStackProps {
  readonly greeting: string;
  /** Either the locale fallback question or the last Sky reply (host state). */
  readonly prompt: string;
}

/** The centre column's headline pair: the crew greeting over the open question. */
export function GreetingStack({ greeting, prompt }: GreetingStackProps) {
  return (
    <div className={GREETING_STACK}>
      <h1 className={GREETING}>{greeting}</h1>
      <p id="prompt" className={PROMPT}>
        {prompt}
      </p>
    </div>
  );
}

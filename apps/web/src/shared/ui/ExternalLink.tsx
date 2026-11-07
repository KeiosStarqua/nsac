import type { ReactNode } from "react";

/** Outbound link. Opens in a new tab without leaking the opener or referrer. */
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

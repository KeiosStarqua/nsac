import type { ReactNode } from "react";

export interface SpotlightCardProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function SpotlightCard(props: SpotlightCardProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="spotlight-card" {...rest}>
      {children}
    </div>
  );
}

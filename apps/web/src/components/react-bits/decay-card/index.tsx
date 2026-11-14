import type { ReactNode } from "react";

export interface DecayCardProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function DecayCard(props: DecayCardProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="decay-card" {...rest}>
      {children}
    </div>
  );
}

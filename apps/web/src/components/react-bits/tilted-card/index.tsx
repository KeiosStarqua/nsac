import type { ReactNode } from "react";

export interface TiltedCardProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function TiltedCard(props: TiltedCardProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="tilted-card" {...rest}>
      {children}
    </div>
  );
}

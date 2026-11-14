import type { ReactNode } from "react";

export interface BounceCardsProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function BounceCards(props: BounceCardsProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="bounce-cards" {...rest}>
      {children}
    </div>
  );
}

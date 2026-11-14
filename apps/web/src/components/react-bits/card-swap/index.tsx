import type { ReactNode } from "react";

export interface CardSwapProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function CardSwap(props: CardSwapProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="card-swap" {...rest}>
      {children}
    </div>
  );
}

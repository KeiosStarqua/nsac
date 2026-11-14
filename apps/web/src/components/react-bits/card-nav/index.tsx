import type { ReactNode } from "react";

export interface CardNavProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function CardNav(props: CardNavProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="card-nav" {...rest}>
      {children}
    </div>
  );
}

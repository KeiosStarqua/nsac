import type { ReactNode } from "react";

export interface PillNavProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function PillNav(props: PillNavProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="pill-nav" {...rest}>
      {children}
    </div>
  );
}

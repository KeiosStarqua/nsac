import type { ReactNode } from "react";

export interface GooeyNavProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function GooeyNav(props: GooeyNavProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="gooey-nav" {...rest}>
      {children}
    </div>
  );
}

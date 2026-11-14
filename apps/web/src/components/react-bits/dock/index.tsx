import type { ReactNode } from "react";

export interface DockProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function Dock(props: DockProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="dock" {...rest}>
      {children}
    </div>
  );
}

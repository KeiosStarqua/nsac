import type { ReactNode } from "react";

export interface BorderGlowProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function BorderGlow(props: BorderGlowProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="border-glow" {...rest}>
      {children}
    </div>
  );
}

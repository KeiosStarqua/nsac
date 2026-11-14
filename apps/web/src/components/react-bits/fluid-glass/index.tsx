import type { ReactNode } from "react";

export interface FluidGlassProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function FluidGlass(props: FluidGlassProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="fluid-glass" {...rest}>
      {children}
    </div>
  );
}

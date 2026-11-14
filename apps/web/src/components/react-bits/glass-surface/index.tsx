import type { ReactNode } from "react";

export interface GlassSurfaceProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function GlassSurface(props: GlassSurfaceProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="glass-surface" {...rest}>
      {children}
    </div>
  );
}

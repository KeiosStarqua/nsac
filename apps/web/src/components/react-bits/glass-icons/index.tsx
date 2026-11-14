import type { ReactNode } from "react";

export interface GlassIconsProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function GlassIcons(props: GlassIconsProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="glass-icons" {...rest}>
      {children}
    </div>
  );
}

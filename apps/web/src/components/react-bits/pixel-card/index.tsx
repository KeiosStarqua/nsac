import type { ReactNode } from "react";

export interface PixelCardProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function PixelCard(props: PixelCardProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="pixel-card" {...rest}>
      {children}
    </div>
  );
}

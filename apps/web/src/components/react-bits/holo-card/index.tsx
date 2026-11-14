import type { ReactNode } from "react";

export interface HoloCardProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function HoloCard(props: HoloCardProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="holo-card" {...rest}>
      {children}
    </div>
  );
}

import type { ReactNode } from "react";

export interface ReflectiveCardProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function ReflectiveCard(props: ReflectiveCardProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="reflective-card" {...rest}>
      {children}
    </div>
  );
}

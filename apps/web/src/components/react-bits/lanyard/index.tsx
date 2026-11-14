import type { ReactNode } from "react";

export interface LanyardProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function Lanyard(props: LanyardProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="lanyard" {...rest}>
      {children}
    </div>
  );
}

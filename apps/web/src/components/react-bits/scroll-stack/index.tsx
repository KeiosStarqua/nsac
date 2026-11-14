import type { ReactNode } from "react";

export interface ScrollStackProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function ScrollStack(props: ScrollStackProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="scroll-stack" {...rest}>
      {children}
    </div>
  );
}

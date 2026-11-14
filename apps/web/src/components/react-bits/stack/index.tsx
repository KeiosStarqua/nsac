import type { ReactNode } from "react";

export interface StackProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function Stack(props: StackProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="stack" {...rest}>
      {children}
    </div>
  );
}

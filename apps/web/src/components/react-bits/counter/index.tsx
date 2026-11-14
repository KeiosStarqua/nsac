import type { ReactNode } from "react";

export interface CounterProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function Counter(props: CounterProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="counter" {...rest}>
      {children}
    </div>
  );
}

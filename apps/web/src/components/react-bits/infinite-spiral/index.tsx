import type { ReactNode } from "react";

export interface InfiniteSpiralProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function InfiniteSpiral(props: InfiniteSpiralProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="infinite-spiral" {...rest}>
      {children}
    </div>
  );
}

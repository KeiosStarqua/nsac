import type { ReactNode } from "react";

export interface AnimatedListProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function AnimatedList(props: AnimatedListProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="animated-list" {...rest}>
      {children}
    </div>
  );
}

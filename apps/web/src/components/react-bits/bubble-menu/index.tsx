import type { ReactNode } from "react";

export interface BubbleMenuProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function BubbleMenu(props: BubbleMenuProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="bubble-menu" {...rest}>
      {children}
    </div>
  );
}

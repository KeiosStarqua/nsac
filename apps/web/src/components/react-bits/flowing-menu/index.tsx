import type { ReactNode } from "react";

export interface FlowingMenuProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function FlowingMenu(props: FlowingMenuProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="flowing-menu" {...rest}>
      {children}
    </div>
  );
}

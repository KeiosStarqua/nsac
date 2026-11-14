import type { ReactNode } from "react";

export interface LineSidebarProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function LineSidebar(props: LineSidebarProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="line-sidebar" {...rest}>
      {children}
    </div>
  );
}

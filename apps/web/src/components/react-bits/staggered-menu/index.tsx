import type { ReactNode } from "react";

export interface StaggeredMenuProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function StaggeredMenu(props: StaggeredMenuProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="staggered-menu" {...rest}>
      {children}
    </div>
  );
}

import type { ReactNode } from "react";

export interface InfiniteMenuProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function InfiniteMenu(props: InfiniteMenuProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="infinite-menu" {...rest}>
      {children}
    </div>
  );
}

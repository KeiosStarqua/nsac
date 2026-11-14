import type { ReactNode } from "react";

export interface MasonryProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function Masonry(props: MasonryProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="masonry" {...rest}>
      {children}
    </div>
  );
}

import type { ReactNode } from "react";

export interface FlyingPostersProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function FlyingPosters(props: FlyingPostersProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="flying-posters" {...rest}>
      {children}
    </div>
  );
}

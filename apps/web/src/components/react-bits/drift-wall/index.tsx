import type { ReactNode } from "react";

export interface DriftWallProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function DriftWall(props: DriftWallProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="drift-wall" {...rest}>
      {children}
    </div>
  );
}

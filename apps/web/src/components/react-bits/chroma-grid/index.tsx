import type { ReactNode } from "react";

export interface ChromaGridProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function ChromaGrid(props: ChromaGridProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="chroma-grid" {...rest}>
      {children}
    </div>
  );
}

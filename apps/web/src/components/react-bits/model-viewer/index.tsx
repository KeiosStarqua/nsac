import type { ReactNode } from "react";

export interface ModelViewerProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function ModelViewer(props: ModelViewerProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="model-viewer" {...rest}>
      {children}
    </div>
  );
}

import type { ReactNode } from "react";

export interface CurvedInputProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function CurvedInput(props: CurvedInputProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="curved-input" {...rest}>
      {children}
    </div>
  );
}

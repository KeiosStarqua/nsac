import type { ReactNode } from "react";

export interface SpecularButtonProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function SpecularButton(props: SpecularButtonProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="specular-button" {...rest}>
      {children}
    </div>
  );
}

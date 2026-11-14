import type { ReactNode } from "react";

export interface OptionWheelProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function OptionWheel(props: OptionWheelProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="option-wheel" {...rest}>
      {children}
    </div>
  );
}

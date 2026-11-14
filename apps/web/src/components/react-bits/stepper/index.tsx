import type { ReactNode } from "react";

export interface StepperProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function Stepper(props: StepperProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="stepper" {...rest}>
      {children}
    </div>
  );
}

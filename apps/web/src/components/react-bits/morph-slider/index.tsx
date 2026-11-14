import type { ReactNode } from "react";

export interface MorphSliderProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function MorphSlider(props: MorphSliderProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="morph-slider" {...rest}>
      {children}
    </div>
  );
}

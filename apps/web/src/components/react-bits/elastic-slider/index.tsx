import type { ReactNode } from "react";

export interface ElasticSliderProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function ElasticSlider(props: ElasticSliderProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="elastic-slider" {...rest}>
      {children}
    </div>
  );
}

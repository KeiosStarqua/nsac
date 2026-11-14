import type { ReactNode } from "react";

export interface DepthCarouselProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function DepthCarousel(props: DepthCarouselProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="depth-carousel" {...rest}>
      {children}
    </div>
  );
}

import type { ReactNode } from "react";

export interface CircularCarouselProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function CircularCarousel(props: CircularCarouselProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="circular-carousel" {...rest}>
      {children}
    </div>
  );
}

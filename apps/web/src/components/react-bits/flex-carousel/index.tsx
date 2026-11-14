import type { ReactNode } from "react";

export interface FlexCarouselProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function FlexCarousel(props: FlexCarouselProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="flex-carousel" {...rest}>
      {children}
    </div>
  );
}

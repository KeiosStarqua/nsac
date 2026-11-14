import type { ReactNode } from "react";

export interface CarouselProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function Carousel(props: CarouselProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="carousel" {...rest}>
      {children}
    </div>
  );
}

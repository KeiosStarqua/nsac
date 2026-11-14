import type { ReactNode } from "react";

export interface CircularGalleryProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function CircularGallery(props: CircularGalleryProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="circular-gallery" {...rest}>
      {children}
    </div>
  );
}

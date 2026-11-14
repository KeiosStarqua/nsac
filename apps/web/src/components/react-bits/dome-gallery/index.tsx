import type { ReactNode } from "react";

export interface DomeGalleryProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function DomeGallery(props: DomeGalleryProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="dome-gallery" {...rest}>
      {children}
    </div>
  );
}

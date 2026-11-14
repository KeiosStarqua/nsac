import type { ReactNode } from "react";

export interface AccordionGalleryProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function AccordionGallery(props: AccordionGalleryProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="accordion-gallery" {...rest}>
      {children}
    </div>
  );
}

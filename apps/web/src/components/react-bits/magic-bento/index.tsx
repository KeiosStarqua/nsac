import type { ReactNode } from "react";

export interface MagicBentoProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function MagicBento(props: MagicBentoProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="magic-bento" {...rest}>
      {children}
    </div>
  );
}

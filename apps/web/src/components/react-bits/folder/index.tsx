import type { ReactNode } from "react";

export interface FolderProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function Folder(props: FolderProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="folder" {...rest}>
      {children}
    </div>
  );
}

import type { ReactNode } from "react";

export interface ProfileCardProps {
  children?: ReactNode;
  [key: string]: unknown;
}

export default function ProfileCard(props: ProfileCardProps) {
  const { children, ...rest } = props;
  return (
    <div data-component="profile-card" {...rest}>
      {children}
    </div>
  );
}

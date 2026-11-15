import type { ReactNode } from "react";
import { MOCK_CENTER, MOCK_LEFT, MOCK_RIGHT } from "../mock-classes";

export interface MockColumnProps {
  readonly children: ReactNode;
}

/**
 * The console's three grid columns. One definition each, shared by the mock console and the
 * declarative `?arch=openui` tree, so the responsive contract (400 / flex / 560, right column under
 * the centre between 721 and 1100, single column below 721) cannot drift between them.
 */
export function LeftColumn({ children }: MockColumnProps) {
  return (
    <div className={MOCK_LEFT} data-column="left">
      {children}
    </div>
  );
}

export function CenterColumn({ children }: MockColumnProps) {
  return (
    <div className={MOCK_CENTER} data-column="center">
      {children}
    </div>
  );
}

export function RightColumn({ children }: MockColumnProps) {
  return (
    <div className={MOCK_RIGHT} data-column="right">
      {children}
    </div>
  );
}

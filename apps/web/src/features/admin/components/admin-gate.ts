// Gate bridge between the AdminLayout (owns `phase`) and the tab components (which must be
// able to bounce the page back to the locked phase when a server function reports
// unauthorized/invalid session mid-tab). One narrow capability, nothing more.
import { createContext, useContext } from "react";

export type AdminGate = {
  /** Flip the page to the locked phase (session rejected by an admin server function). */
  lock: () => void;
};

export const AdminGateContext = createContext<AdminGate | null>(null);

export function useAdminGate(): AdminGate {
  const gate = useContext(AdminGateContext);
  if (!gate) {
    throw new Error("useAdminGate must be used inside AdminLayout (the /admin route tree).");
  }
  return gate;
}

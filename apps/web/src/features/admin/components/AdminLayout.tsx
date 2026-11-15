import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCopy } from "~/shared/i18n";
import { MorphingTabs } from "~/shared/beui/morphing-tabs";
import {
  unlockAdminFn,
  isAdminFn,
} from "../api/admin.functions";
import { ADMIN_TABS, adminTabFromPathname, adminTabRoute } from "../model/admin-tabs";
import { AdminGateContext, type AdminGate } from "./admin-gate";
import { buttonClasses, inputClasses, muted, page, panel } from "./tabs/classes";

type Phase = "checking" | "unconfigured" | "locked" | "admin";

export function AdminLayout() {
  const copy = useCopy().admin;
  const [phase, setPhase] = useState<Phase>("checking");

  // Unlock form
  const [key, setKey] = useState("");
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentTab = adminTabFromPathname(pathname);
  const gate = useMemo<AdminGate>(() => ({ lock: () => setPhase("locked") }), []);

  useEffect(() => {
    let cancelled = false;
    isAdminFn()
      .then((r) => {
        if (cancelled) return;
        setPhase(!r.configured ? "unconfigured" : r.admin ? "admin" : "locked");
      })
      .catch(() => {
        if (!cancelled) setPhase("locked");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitUnlock(e: FormEvent) {
    e.preventDefault();
    if (unlockBusy || key.length === 0) return;
    setUnlockBusy(true);
    setUnlockError(null);
    try {
      const r = await unlockAdminFn({ data: { key } });
      if (r.status === "ok") {
        setKey("");
        setPhase("admin");
      } else if (r.status === "not_configured") {
        setPhase("unconfigured");
      } else {
        setUnlockError(copy.denied);
      }
    } catch {
      setUnlockError(copy.denied);
    } finally {
      setUnlockBusy(false);
    }
  }

  if (phase === "checking") {
    return (
      <main className={page}>
        <div className={panel}>
          <p className={muted}>{copy.checking}</p>
        </div>
      </main>
    );
  }

  if (phase === "unconfigured") {
    return (
      <main className={page}>
        <div className={panel}>
          <h1 className="text-[20px]">{copy.title}</h1>
          <p className={muted}>{copy.notConfigured}</p>
        </div>
      </main>
    );
  }

  if (phase === "locked") {
    return (
      <main className={page}>
        <div className="mx-auto max-w-[420px] px-5 pt-7 pb-12">
          <h1 className="mb-4! text-[20px]">{copy.unlockTitle}</h1>
          <form onSubmit={submitUnlock}>
            <label
              htmlFor="sky-admin-key"
              className="mb-1.5 block text-[13px] text-(--muted)"
            >
              {copy.keyLabel}
            </label>
            <input
              id="sky-admin-key"
              type="password"
              autoComplete="off"
              autoFocus
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className={inputClasses}
            />
            {unlockError && (
              <p role="alert" className="mt-2.5! text-[13px] text-(--red)">
                {unlockError}
              </p>
            )}
            <button
              type="submit"
              disabled={unlockBusy || key.length === 0}
              className={`${buttonClasses} mt-3.5`}
            >
              {unlockBusy ? copy.unlocking : copy.unlock}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className={page}>
      <div className={panel}>
        <h1 className="mb-3! text-[20px]">{copy.title}</h1>

        <AdminGateContext.Provider value={gate}>
          <MorphingTabs
            value={currentTab}
            ariaLabel={copy.tabsLabel}
            classNames={{ content: "p-4 sm:p-5" }}
            onValueChange={(id) => {
              const to = adminTabRoute(id);
              if (to) navigate({ to, replace: false });
            }}
            items={ADMIN_TABS.map((tab) => ({
              id: tab.id,
              label: copy[tab.labelKey],
              icon: <tab.icon aria-hidden className="size-5" />,
              // Every item points at the same Outlet; TanStack swaps the tab by route.
              // The liquid pill + panel enter/exit animations key off the item id (the tab = the route).
              content: <Outlet />,
            }))}
          />
        </AdminGateContext.Provider>
      </div>
    </main>
  );
}

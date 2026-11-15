import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { KeyRound, Lock } from "lucide-react";
import { useCopy } from "~/shared/i18n";
import { MorphingTabs } from "~/shared/beui/morphing-tabs";
import { useMediaQuery } from "~/shared/hooks/useMediaQuery";
import {
  unlockAdminFn,
  lockAdminFn,
  isAdminFn,
} from "../api/admin.functions";
import { ADMIN_TABS, adminTabFromPathname, adminTabRoute } from "../model/admin-tabs";
import { AdminGateContext, type AdminGate } from "./admin-gate";
import { selectClasses, buttonClasses, ghostButtonClasses, inputClasses, muted, page, panel } from "./tabs/classes";

type Phase = "checking" | "unconfigured" | "locked" | "admin";

// Shared shell for the three pre-auth phases (checking / unconfigured / locked): one centered
// instrument card on the dark field, same geometry, so the page never jumps between states.
function CenteredCard({ children }: { children: ReactNode }) {
  return (
    <main className={`${page} grid min-h-dvh place-items-center px-4 py-10`}>
      <div className="w-full max-w-[430px] rounded-(--radius) border border-(--border) bg-(--surface) p-6 shadow-(--shadow-raised)">
        {children}
      </div>
    </main>
  );
}

export function AdminLayout() {
  const copy = useCopy().admin;
  const [phase, setPhase] = useState<Phase>("checking");

  // Unlock form
  const [key, setKey] = useState("");
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [lockBusy, setLockBusy] = useState(false);

  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentTab = adminTabFromPathname(pathname);
  // ≤480px: the beui rail can only fit icon-only tabs there — swap in an explicit labeled picker.
  const compactNav = useMediaQuery("(max-width: 480px)");
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

  async function lockSession() {
    if (lockBusy) return;
    setLockBusy(true);
    try {
      await lockAdminFn();
    } catch {
      // Clearing the local phase is still correct — the cookie expiry bounds the worst case at 30 min.
    } finally {
      setLockBusy(false);
      setPhase("locked");
    }
  }

  if (phase === "checking") {
    return (
      <CenteredCard>
        <div className="flex items-center gap-3.5">
          <span
            aria-hidden
            className="grid size-11 shrink-0 place-items-center rounded-(--radius-sm) border border-(--border) bg-(--surface-2)"
          >
            <KeyRound className="size-5 text-(--muted)" />
          </span>
          <div>
            <h1 className="text-[17px] leading-6">{copy.title}</h1>
            <p className="mt-0.5 text-[14px] text-(--muted)">{copy.checking}</p>
          </div>
        </div>
      </CenteredCard>
    );
  }

  if (phase === "unconfigured") {
    return (
      <CenteredCard>
        <div className="flex items-center gap-3.5">
          <span
            aria-hidden
            className="grid size-11 shrink-0 place-items-center rounded-(--radius-sm) border border-(--border) bg-(--surface-2)"
          >
            <KeyRound className="size-5 text-(--muted)" />
          </span>
          <div>
            <h1 className="text-[17px] leading-6">{copy.title}</h1>
            <p className="mt-0.5 text-[14px] text-(--muted)">{copy.notConfigured}</p>
          </div>
        </div>
      </CenteredCard>
    );
  }

  if (phase === "locked") {
    return (
      <CenteredCard>
        <div className="flex items-center gap-3.5">
          <span
            aria-hidden
            className="grid size-11 shrink-0 place-items-center rounded-(--radius-sm) border border-(--border) bg-(--surface-2)"
          >
            <KeyRound className="size-5 text-(--accent)" />
          </span>
          <div>
            <h1 className="text-[17px] leading-6">{copy.unlockTitle}</h1>
            <p className="mt-0.5 text-[14px] leading-5 text-(--muted)">{copy.unlockDescription}</p>
          </div>
        </div>
        <form onSubmit={submitUnlock} className="mt-5">
          <label htmlFor="sky-admin-key" className="mb-1.5 block text-[14px] text-(--muted)">
            {copy.keyLabel}
          </label>
          <input
            id="sky-admin-key"
            type="password"
            autoComplete="off"
            autoFocus
            spellCheck={false}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className={inputClasses}
          />
          {unlockError && (
            <p role="alert" className="mt-2.5! text-[14px] text-(--red)">
              {unlockError}
            </p>
          )}
          <button
            type="submit"
            disabled={unlockBusy || key.length === 0}
            className={`${buttonClasses} mt-4 w-full`}
          >
            {unlockBusy ? copy.unlocking : copy.unlock}
          </button>
        </form>
      </CenteredCard>
    );
  }

  return (
    <main className={page}>
      <div className={panel}>
        <header className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 sm:mb-5">
          <div>
            <h1 className="text-[clamp(19px,2vw,26px)] font-light leading-8 tracking-[-0.01em]">{copy.title}</h1>
            <p className="mt-1 max-w-[62ch] text-[14px] leading-5 text-(--muted)">{copy.pageDescription}</p>
          </div>
          <button
            type="button"
            onClick={lockSession}
            disabled={lockBusy}
            className={`${ghostButtonClasses} inline-flex items-center gap-2 px-4! py-2! text-[14px]!`}
          >
            <Lock aria-hidden className="size-4" />
            {copy.lock}
          </button>
        </header>

        <AdminGateContext.Provider value={gate}>
          {compactNav ? (
            <>
              <label htmlFor="admin-section" className="mb-1.5 block text-[14px] text-(--muted)">
                {copy.tabsLabel}
              </label>
              <select
                id="admin-section"
                className={`${selectClasses} cursor-pointer`}
                value={currentTab}
                onChange={(e) => {
                  const to = adminTabRoute(e.target.value);
                  if (to) navigate({ to, replace: false });
                }}
              >
                {ADMIN_TABS.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {copy[tab.labelKey]}
                  </option>
                ))}
              </select>
              <div className="mt-3 rounded-(--radius-sm) border border-(--border) bg-(--surface-2) p-4 text-(--text)">
                <Outlet />
              </div>
            </>
          ) : (
            <MorphingTabs
              value={currentTab}
              ariaLabel={copy.tabsLabel}
              classNames={{ content: "p-4 sm:p-6" }}
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
          )}
        </AdminGateContext.Provider>
      </div>
    </main>
  );
}

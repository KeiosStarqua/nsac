import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Bot, KeyRound, Mic, RotateCcw, Volume2 } from "lucide-react";
import { useCopy } from "~/shared/i18n";
import { MorphingTabs } from "~/shared/beui/morphing-tabs";
import {
  unlockAdminFn,
  isAdminFn,
  adminModelFn,
  setAgentConfigFn,
  resetClaimsFn,
} from "../api/admin.functions";
import {
  getElevenLabsStatusFn,
  setElevenLabsKeyFn,
  clearElevenLabsKeyFn,
} from "../api/elevenlabs.functions";
import { SpeechEnginePanel } from "./SpeechEnginePanel";
import {
  getOpenCodeKeyInfoFn,
  saveOpenCodeKeyFn,
  clearOpenCodeKeyFn,
} from "../api/opencode-key.functions";
import type { ResetClaimsResult, AgentModelsSetting } from "../api/admin.functions";
import type { CatalogModel } from "../runtime/openrouter.server";
import { goAsPickerModels, bedrockAsPickerModels, type PickerModel } from "../model/catalog";
import type { AgentProvider } from "../../agent/runtime/agent-model.server";

type Phase = "checking" | "unconfigured" | "locked" | "admin";
type ApplyState = { kind: "ok" } | { kind: "error"; message: string } | null;
type ResetState = { kind: "ok"; cleared: number } | { kind: "error"; message: string } | null;
type EffectiveModels = {
  default: string;
  chat: string;
  orchestrator: string;
  "generative-ui": string;
  "hud-composer": string;
};
type ElevenLabsStatus = { configured: boolean; updatedAt: number | null };
type ElevenLabsState = { kind: "ok"; message: string } | { kind: "error"; message: string } | null;
type OpenCodeKeyInfo = { source: "env" | "file" | "none"; updatedAt: number | null };
type OpenCodeKeyState = { kind: "ok"; message: string } | { kind: "error"; message: string } | null;
const GO_KEY_REGEX = /^[!-~]{8,512}$/;

const page = "min-h-screen bg-(--bg) text-(--text) font-(family-name:--font)";
const panel = "mx-auto max-w-[1040px] px-5 pt-7 pb-12";
const mono = "font-(family-name:--mono)";
const muted = "text-(--muted)";
// `!` marks the few utilities that must win against globals.css, whose reset is unlayered and therefore
// outranks Tailwind's utility layer: `button { font: inherit }` (font-size/weight) and
// `:focus-visible { border-radius: 4px }` (radius on any focusable control).
const inputClasses =
  "w-full rounded-(--radius-sm)! border border-(--border) bg-(--surface) px-3 py-2.5 text-[14px] text-(--text)";
const buttonClasses =
  "cursor-pointer rounded-(--radius-sm)! border-none border-(--accent-ink) bg-(--accent) px-[18px] py-2.5 text-[14px]! font-semibold! text-(--accent-ink) disabled:opacity-60";
const dangerButtonClasses =
  "cursor-pointer rounded-(--radius-sm)! border border-(--red) bg-transparent px-[18px] py-2.5 text-[14px]! font-semibold! text-(--red) disabled:opacity-60";
const ghostButtonClasses =
  "cursor-pointer rounded-(--radius-sm)! border border-(--border) bg-transparent px-[18px] py-2.5 text-[14px]! font-semibold! text-(--text) disabled:opacity-60";

function fmtPrice(p: string | null): string {
  if (p == null) return "—";
  const perMillion = Number(p) * 1e6;
  if (!Number.isFinite(perMillion)) return "—";
  if (perMillion === 0) return "$0/M";
  if (perMillion < 0.01) return "<$0.01/M";
  return `$${perMillion.toFixed(2)}/M`;
}
const fmtContext = (n: number | null) => (n == null ? "—" : n.toLocaleString());

/** Option label for a model: id, prices, context window. */
function modelOptionLabel(m: PickerModel): string {
  return `${m.id} — ${fmtPrice(m.prompt)} in / ${fmtPrice(m.completion)} out · ctx ${fmtContext(m.contextLength)}`;
}

export function AdminPage() {
  const copy = useCopy().admin;
  const [phase, setPhase] = useState<Phase>("checking");

  // Unlock form
  const [key, setKey] = useState("");
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Authenticated state
  const [effectiveModels, setEffectiveModels] = useState<EffectiveModels | null>(null);
  const [provider, setProvider] = useState<AgentProvider>("opencode-go");
  const [effectiveProvider, setEffectiveProvider] = useState<AgentProvider>("opencode-go");
  const [providerSource, setProviderSource] = useState<string>("default");
  const [setting, setSetting] = useState<AgentModelsSetting | null | undefined>(undefined);
  const [openrouterModels, setOpenrouterModels] = useState<PickerModel[]>([]);
  const [openrouterOk, setOpenrouterOk] = useState(true);
  const [defaultModel, setDefaultModel] = useState<string>("");
  const [profileModels, setProfileModels] = useState<Record<string, string>>({
    "sky-chat": "",
    "sky-orchestrator": "",
    "sky-generative-ui": "",
    "sky-hud-composer": "",
  });
  const [loadingModels, setLoadingModels] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyState, setApplyState] = useState<ApplyState>(null);

  // Claims reset (demo housekeeping — claims are HUD data, nothing here refreshes)
  const [resetBusy, setResetBusy] = useState(false);
  const [resetState, setResetState] = useState<ResetState>(null);

  // ElevenLabs key (Sky TTS). Write-only: the stored key is never rendered anywhere.
  const [elevenStatus, setElevenStatus] = useState<ElevenLabsStatus | undefined>(undefined);
  const [elevenKey, setElevenKey] = useState("");
  const [elevenBusy, setElevenBusy] = useState(false);
  const [elevenClearBusy, setElevenClearBusy] = useState(false);
  const [elevenConfirmClear, setElevenConfirmClear] = useState(false);
  const [elevenState, setElevenState] = useState<ElevenLabsState>(null);

  // OpenCode Go key (agent). Write-only: the stored key is never rendered anywhere.
  const [goStatus, setGoStatus] = useState<OpenCodeKeyInfo | undefined>(undefined);
  const [goKey, setGoKey] = useState("");
  const [goBusy, setGoBusy] = useState(false);
  const [goClearBusy, setGoClearBusy] = useState(false);
  const [goConfirmClear, setGoConfirmClear] = useState(false);
  const [goState, setGoState] = useState<OpenCodeKeyState>(null);

  // The Go and Bedrock snapshots are static and imported locally — no fetch, works offline.
  const goModels = useMemo(() => goAsPickerModels(), []);
  const bedrockModels = useMemo(() => bedrockAsPickerModels(), []);
  const catalog =
    provider === "opencode-go" ? goModels : provider === "amazon-bedrock" ? bedrockModels : openrouterModels;
  const catalogReady = provider !== "openrouter" || openrouterOk;

  async function loadConfig() {
    setLoadingModels(true);
    try {
      const r = await adminModelFn();
      if (r.status === "ok") {
        setProvider(r.provider);
        setEffectiveProvider(r.provider);
        setProviderSource(r.providerSource);
        setEffectiveModels(r.effectiveModels);
        setSetting(r.setting);
        setOpenrouterModels(r.openrouterModels);
        setOpenrouterOk(r.openrouterOk);
        setDefaultModel(r.setting?.model ?? "");
        const stored = r.setting?.models ?? {};
        setProfileModels({
          "sky-chat": stored["sky-chat"] ?? "",
          "sky-orchestrator": stored["sky-orchestrator"] ?? "",
          "sky-generative-ui": stored["sky-generative-ui"] ?? "",
          "sky-hud-composer": stored["sky-hud-composer"] ?? "",
        });
      } else {
        setPhase("locked");
      }
    } catch {
      setOpenrouterModels([]);
      setOpenrouterOk(false);
    } finally {
      setLoadingModels(false);
    }
  }

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

  useEffect(() => {
    if (phase !== "admin") return;
    let cancelled = false;
    getElevenLabsStatusFn()
      .then((r) => {
        if (!cancelled) setElevenStatus(r);
      })
      .catch(() => {
        if (!cancelled) setElevenStatus({ configured: false, updatedAt: null });
      });
    return () => {
      cancelled = true;
    };
  }, [phase]);

  async function refreshGoStatus() {
    try {
      const r = await getOpenCodeKeyInfoFn();
      setGoStatus(r.status === "ok" ? { source: r.source, updatedAt: r.updatedAt } : { source: "none", updatedAt: null });
    } catch {
      setGoStatus({ source: "none", updatedAt: null });
    }
  }

  useEffect(() => {
    if (phase !== "admin") return;
    let cancelled = false;
    getOpenCodeKeyInfoFn()
      .then((r) => {
        if (!cancelled) {
          setGoStatus(r.status === "ok" ? { source: r.source, updatedAt: r.updatedAt } : { source: "none", updatedAt: null });
        }
      })
      .catch(() => {
        if (!cancelled) setGoStatus({ source: "none", updatedAt: null });
      });
    return () => {
      cancelled = true;
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "admin") return;
    void loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const profileFields = [
    { id: "sky-chat" as const, label: copy.profileChatLabel, hint: copy.profileChatHint, effective: effectiveModels?.chat },
    { id: "sky-orchestrator" as const, label: copy.profileOrchestratorLabel, hint: copy.profileOrchestratorHint, effective: effectiveModels?.orchestrator },
    { id: "sky-generative-ui" as const, label: copy.profileGenerativeUiLabel, hint: copy.profileGenerativeUiHint, effective: effectiveModels?.["generative-ui"] },
    { id: "sky-hud-composer" as const, label: copy.profileHudComposerLabel, hint: copy.profileHudComposerHint, effective: effectiveModels?.["hud-composer"] },
  ];

  // Options for a select; a stored id missing from the catalog is kept as a visible placeholder.
  function optionsFor(selected: string): PickerModel[] {
    if (!selected || catalog.some((m) => m.id === selected)) return catalog;
    return [{ id: selected, name: selected, contextLength: null, prompt: null, completion: null, created: null }, ...catalog];
  }

  function optionLabel(m: PickerModel): string {
    const known = catalog.some((c) => c.id === m.id);
    return known ? modelOptionLabel(m) : `${m.id} (not in catalog)`;
  }

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

  async function apply() {
    if (applying) return;
    setApplying(true);
    setApplyState(null);
    const models: Record<string, string> = {};
    for (const field of profileFields) {
      const v = profileModels[field.id]?.trim();
      if (v) models[field.id] = v;
    }
    try {
      const r = await setAgentConfigFn({
        data: { provider, model: defaultModel.trim() ? defaultModel.trim() : null, models },
      });
      if (r.status === "ok") {
        setApplyState({ kind: "ok" });
        await loadConfig();
      } else if (r.status === "invalid_model") {
        setApplyState({ kind: "error", message: copy.invalidModel });
      } else if (r.status === "catalog_unavailable") {
        setApplyState({ kind: "error", message: copy.catalogUnavailable });
      } else if (r.status === "backend_error") {
        setApplyState({ kind: "error", message: copy.backendError });
      } else {
        setApplyState({ kind: "error", message: copy.unauthorized });
        setPhase("locked");
      }
    } catch {
      setApplyState({ kind: "error", message: copy.applyFailed });
    } finally {
      setApplying(false);
    }
  }

  async function resetClaims() {
    if (resetBusy) return;
    if (!window.confirm(copy.resetClaimsConfirm)) return;
    setResetBusy(true);
    setResetState(null);
    try {
      const r: ResetClaimsResult = await resetClaimsFn();
      if (r.status === "ok") {
        setResetState({ kind: "ok", cleared: r.cleared });
      } else if (r.status === "unauthorized") {
        setPhase("locked");
      } else {
        setResetState({ kind: "error", message: copy.resetClaimsFailed });
      }
    } catch {
      setResetState({ kind: "error", message: copy.resetClaimsFailed });
    } finally {
      setResetBusy(false);
    }
  }

  async function saveElevenLabsKey() {
    const trimmed = elevenKey.trim();
    if (!trimmed || elevenBusy) return;
    setElevenBusy(true);
    setElevenState(null);
    try {
      const r = await setElevenLabsKeyFn({ data: { key: trimmed } });
      if (r.status === "ok") {
        setElevenKey("");
        setElevenStatus({ configured: true, updatedAt: r.updatedAt });
        setElevenState({ kind: "ok", message: copy.elevenlabsSaved });
      } else if (r.status === "invalid_key") {
        setElevenState({ kind: "error", message: copy.elevenlabsInvalidKey });
      } else if (r.status === "backend_error") {
        setElevenState({ kind: "error", message: copy.elevenlabsSaveFailed });
      } else {
        setPhase("locked");
      }
    } catch {
      setElevenState({ kind: "error", message: copy.elevenlabsSaveFailed });
    } finally {
      setElevenBusy(false);
    }
  }

  async function clearElevenLabsKey() {
    if (elevenClearBusy) return;
    setElevenClearBusy(true);
    setElevenState(null);
    try {
      const r = await clearElevenLabsKeyFn();
      if (r.status === "ok") {
        setElevenStatus({ configured: false, updatedAt: null });
        setElevenState({ kind: "ok", message: copy.elevenlabsClearDone });
      } else if (r.status === "unauthorized") {
        setPhase("locked");
      } else {
        setElevenState({ kind: "error", message: copy.elevenlabsClearFailed });
      }
    } catch {
      setElevenState({ kind: "error", message: copy.elevenlabsClearFailed });
    } finally {
      setElevenClearBusy(false);
      setElevenConfirmClear(false);
    }
  }

  async function saveGoKey() {
    const trimmed = goKey.trim();
    if (!GO_KEY_REGEX.test(trimmed) || goBusy) return;
    setGoBusy(true);
    setGoState(null);
    try {
      const r = await saveOpenCodeKeyFn({ data: { key: trimmed } });
      if (r.status === "ok") {
        setGoKey("");
        await refreshGoStatus();
        setGoState({ kind: "ok", message: copy.goKeySaved });
      } else if (r.status === "invalid_key") {
        setGoState({ kind: "error", message: copy.goKeyInvalidKey });
      } else if (r.status === "unauthorized") {
        setPhase("locked");
      } else {
        setGoState({ kind: "error", message: copy.goKeySaveFailed });
      }
    } catch {
      setGoState({ kind: "error", message: copy.goKeySaveFailed });
    } finally {
      setGoBusy(false);
    }
  }

  async function clearGoKey() {
    if (goClearBusy) return;
    setGoClearBusy(true);
    setGoState(null);
    try {
      const r = await clearOpenCodeKeyFn();
      if (r.status === "ok") {
        await refreshGoStatus();
        setGoState({ kind: "ok", message: copy.goKeyClearDone });
      } else {
        setPhase("locked");
      }
    } catch {
      setGoState({ kind: "error", message: copy.goKeyClearFailed });
    } finally {
      setGoClearBusy(false);
      setGoConfirmClear(false);
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

  const selectClasses = `${inputClasses} cursor-pointer`;
  const effectiveLine = copy.effectiveLine
    .replace("{model}", effectiveModels?.default ?? "…")
    .replace("{provider}", effectiveProvider);

  return (
    <main className={page}>
      <div className={panel}>
        <h1 className="mb-3! text-[20px]">{copy.title}</h1>

        <MorphingTabs
          defaultValue="models"
          ariaLabel={copy.tabsLabel}
          classNames={{ content: "p-4 sm:p-5" }}
          items={[
            {
              id: "models",
              label: copy.tabModels,
              icon: <Bot aria-hidden className="size-5" />,
              content: (
                <>
                <section
                  aria-label={copy.currentEffective}
                  className="mb-4 rounded-(--radius-sm) border border-(--border) bg-(--surface) px-3.5 py-3"
                >
                  <div className={`${muted} text-[12px] uppercase tracking-[1px]`}>
                    {copy.currentEffective}
                  </div>
                  <div className={`${mono} mt-1 text-[13px] break-all`}>{effectiveLine}</div>
                  <ul className={`${mono} mt-2 list-none p-0 text-[12px] leading-6`}>
                    <li>default={effectiveModels?.default ?? "…"}</li>
                    <li>sky-chat={effectiveModels?.chat ?? "…"}</li>
                    <li>sky-orchestrator={effectiveModels?.orchestrator ?? "…"}</li>
                    <li>sky-generative-ui={effectiveModels?.["generative-ui"] ?? "…"}</li>
                    <li>sky-hud-composer={effectiveModels?.["hud-composer"] ?? "…"}</li>
                  </ul>
                  <div className={`${muted} mt-1.5 text-[12px]`}>
                    {(() => {
                      const parts = [
                        setting?.provider ? `provider=${setting.provider}` : null,
                        setting?.model ? `model=${setting.model}` : null,
                        setting?.models && Object.keys(setting.models).length > 0
                          ? `models=${Object.keys(setting.models).join(",")}`
                          : null,
                      ].filter((part): part is string => part !== null);
                      if (parts.length === 0) return copy.envFallback;
                      const stamp = setting?.updatedAt
                        ? ` · ${new Date(setting.updatedAt).toISOString().replace("T", " ").slice(0, 19)} UTC`
                        : "";
                      return `${copy.backendSetting} (${providerSource}): ${parts.join(" · ")}${stamp}`;
                    })()}
                  </div>
                  <div className={`${muted} mt-1 text-[12px]`}>{copy.appliesNote}</div>
                </section>

                {/* Provider */}
                <label htmlFor="admin-provider" className="mb-1.5 block text-[13px]">
                  {copy.providerLabel}
                </label>
                <select
                  id="admin-provider"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as AgentProvider)}
                  className={selectClasses}
                >
                  <option value="opencode-go">{copy.providerOpencodeGo}</option>
                  <option value="openrouter">{copy.providerOpenrouter}</option>
                  <option value="amazon-bedrock">{copy.providerAmazonBedrock}</option>
                </select>
                <p className={`${muted} mt-1.5 text-[12px]`}>
                  {provider === "opencode-go"
                    ? copy.providerOpencodeGoDesc
                    : provider === "amazon-bedrock"
                      ? copy.providerAmazonBedrockDesc
                      : copy.providerOpenrouterDesc}
                </p>
                {provider === "amazon-bedrock" && <p className={`${muted} mt-1 text-[12px]`}>{copy.bedrockVerifiedNote}</p>}
                {provider === "openrouter" && <p className={`${muted} mt-1 text-[12px]`}>{copy.legacyNote}</p>}

                {!catalogReady && (
                  <p role="alert" className="mt-2 text-[13px] text-(--yellow)">
                    {copy.catalogError}
                  </p>
                )}

                {/* Default (all agents) */}
                <label htmlFor="admin-default-model" className="mt-4 mb-1.5 block text-[13px]">
                  {copy.defaultAllLabel}
                </label>
                <p className={`${muted} mb-1.5 text-[12px]`}>{copy.defaultAllHint}</p>
                <select
                  id="admin-default-model"
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  className={selectClasses}
                  disabled={loadingModels}
                >
                  <option value="">{copy.inheritDefault}</option>
                  {optionsFor(defaultModel).map((m) => (
                    <option key={m.id} value={m.id}>
                      {optionLabel(m)}
                    </option>
                  ))}
                </select>

                {/* Per-profile overrides */}
                {profileFields.map((field) => (
                  <div key={field.id} className="mt-4">
                    <label htmlFor={`admin-model-${field.id}`} className="block text-[13px]">
                      {field.label}
                    </label>
                    <p className={`${muted} mt-0.5 mb-1.5 text-[12px]`}>{field.hint}</p>
                    <select
                      id={`admin-model-${field.id}`}
                      value={profileModels[field.id] ?? ""}
                      onChange={(e) => setProfileModels((prev) => ({ ...prev, [field.id]: e.target.value }))}
                      className={selectClasses}
                      disabled={loadingModels}
                    >
                      <option value="">
                        {copy.inheritProfile} — {effectiveModels ? (field.effective ?? effectiveModels.default) : "…"}
                      </option>
                      {optionsFor(profileModels[field.id] ?? "").map((m) => (
                        <option key={m.id} value={m.id}>
                          {optionLabel(m)}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}

                <div className="mt-5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={apply}
                    disabled={applying || loadingModels || !catalogReady}
                    className={buttonClasses}
                  >
                    {applying ? copy.applying : copy.apply}
                  </button>
                  <div aria-live="polite" className="text-[13px]">
                    {applyState?.kind === "ok" && <span className="text-(--green)">{copy.saved}</span>}
                    {applyState?.kind === "error" && <span className="text-(--red)">{applyState.message}</span>}
                  </div>
                </div>
                </>
              ),
            },
            {
              id: "opencode",
              label: copy.tabOpencode,
              icon: <KeyRound aria-hidden className="size-5" />,
              content: (
                <>
                <section
                  aria-label={copy.goKeyTitle}
                  className="rounded-(--radius-sm) border border-(--border) bg-(--surface) px-3.5 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className={`${muted} text-[12px] uppercase tracking-[1px]`}>
                      {copy.goKeyTitle}
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-[1px] ${
                        goStatus?.source && goStatus.source !== "none"
                          ? "border-(--green) text-(--green)"
                          : "border-(--border) text-(--muted)"
                      }`}
                    >
                      {goStatus == null
                        ? copy.checking
                        : goStatus.source === "env"
                          ? copy.goKeyConfiguredEnv
                          : goStatus.source === "file"
                            ? copy.goKeyConfiguredFile
                            : copy.goKeyNotConfigured}
                    </span>
                  </div>
                  {goStatus?.source === "env" && (
                    <p className={`${muted} mt-2 text-[12px]`}>{copy.goKeyEnvHint}</p>
                  )}
                  <form
                    className="mt-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveGoKey();
                    }}
                  >
                    <label
                      htmlFor="sky-opencode-key"
                      className="mb-1.5 block text-[13px] text-(--muted)"
                    >
                      {copy.goKeyLabel}
                    </label>
                    <input
                      id="sky-opencode-key"
                      type="password"
                      autoComplete="off"
                      placeholder={goStatus?.source === "file" ? copy.goKeyPlaceholderStored : copy.goKeyPlaceholder}
                      value={goKey}
                      onChange={(e) => setGoKey(e.target.value)}
                      className={inputClasses}
                    />
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        type="submit"
                        disabled={goBusy || !GO_KEY_REGEX.test(goKey.trim())}
                        className={buttonClasses}
                      >
                        {goBusy ? copy.goKeySaving : copy.goKeySave}
                      </button>
                      {goConfirmClear ? (
                    <>
                          <button
                            type="button"
                            onClick={clearGoKey}
                            disabled={goClearBusy}
                            className={dangerButtonClasses}
                          >
                            {goClearBusy ? copy.goKeyClearing : copy.goKeyClearConfirm}
                          </button>
                          <button
                            type="button"
                            onClick={() => setGoConfirmClear(false)}
                            disabled={goClearBusy}
                            className={ghostButtonClasses}
                          >
                            {copy.goKeyClearCancel}
                          </button>
                    </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setGoConfirmClear(true)}
                          disabled={goClearBusy}
                          className={dangerButtonClasses}
                        >
                          {copy.goKeyClear}
                        </button>
                      )}
                      <div aria-live="polite" className="text-[13px]">
                        {goState?.kind === "ok" && (
                          <span className="text-(--green)">{goState.message}</span>
                        )}
                        {goState?.kind === "error" && (
                          <span className="text-(--red)">{goState.message}</span>
                        )}
                      </div>
                    </div>
                  </form>
                  <p className={`${muted} mt-2 text-[12px]`}>{copy.goKeyNote}</p>
                </section>
                </>
              ),
            },
            {
              id: "elevenlabs",
              label: copy.tabElevenlabs,
              icon: <Volume2 aria-hidden className="size-5" />,
              content: (
                <>
                <section
                  aria-label={copy.elevenlabsTitle}
                  className="rounded-(--radius-sm) border border-(--border) bg-(--surface) px-3.5 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className={`${muted} text-[12px] uppercase tracking-[1px]`}>
                      {copy.elevenlabsTitle}
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-[1px] ${
                        elevenStatus?.configured
                          ? "border-(--green) text-(--green)"
                          : "border-(--border) text-(--muted)"
                      }`}
                    >
                      {elevenStatus?.configured ? copy.elevenlabsConfigured : copy.elevenlabsNotConfigured}
                    </span>
                  </div>
                  <form
                    className="mt-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveElevenLabsKey();
                    }}
                  >
                    <label
                      htmlFor="sky-elevenlabs-key"
                      className="mb-1.5 block text-[13px] text-(--muted)"
                    >
                      {copy.elevenlabsKeyLabel}
                    </label>
                    <input
                      id="sky-elevenlabs-key"
                      type="password"
                      autoComplete="off"
                      placeholder="sk_…"
                      value={elevenKey}
                      onChange={(e) => setElevenKey(e.target.value)}
                      className={inputClasses}
                    />
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        type="submit"
                        disabled={elevenBusy || elevenKey.trim().length === 0}
                        className={buttonClasses}
                      >
                        {elevenBusy ? copy.elevenlabsSaving : copy.elevenlabsSave}
                      </button>
                      {elevenConfirmClear ? (
                    <>
                          <button
                            type="button"
                            onClick={clearElevenLabsKey}
                            disabled={elevenClearBusy}
                            className={dangerButtonClasses}
                          >
                            {elevenClearBusy ? copy.elevenlabsClearing : copy.elevenlabsClearConfirm}
                          </button>
                          <button
                            type="button"
                            onClick={() => setElevenConfirmClear(false)}
                            disabled={elevenClearBusy}
                            className={ghostButtonClasses}
                          >
                            {copy.elevenlabsClearCancel}
                          </button>
                    </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setElevenConfirmClear(true)}
                          disabled={elevenClearBusy}
                          className={dangerButtonClasses}
                        >
                          {copy.elevenlabsClear}
                        </button>
                      )}
                      <div aria-live="polite" className="text-[13px]">
                        {elevenState?.kind === "ok" && (
                          <span className="text-(--green)">{elevenState.message}</span>
                        )}
                        {elevenState?.kind === "error" && (
                          <span className="text-(--red)">{elevenState.message}</span>
                        )}
                      </div>
                    </div>
                  </form>
                  <p className={`${muted} mt-2 text-[12px]`}>{copy.elevenlabsNote}</p>
                </section>
                </>
              ),
            },
            {
              id: "speech",
              label: copy.tabSpeech,
              icon: <Mic aria-hidden className="size-5" />,
              content: <SpeechEnginePanel onSessionExpired={() => setPhase("locked")} />,
            },
            {
              id: "claims",
              label: copy.tabClaims,
              icon: <RotateCcw aria-hidden className="size-5" />,
              content: (
                <>
                <section
                  aria-label={copy.resetClaims}
                  className="rounded-(--radius-sm) border border-(--border) bg-(--surface) px-3.5 py-3"
                >
                  <div className={`${muted} text-[12px] uppercase tracking-[1px]`}>{copy.resetClaims}</div>
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={resetClaims}
                      disabled={resetBusy}
                      className={dangerButtonClasses}
                    >
                      {resetBusy ? copy.resetting : copy.resetClaims}
                    </button>
                    <div aria-live="polite" className="text-[13px]">
                      {resetState?.kind === "ok" && (
                        <span className="text-(--green)">
                          {copy.resetClaimsDone.replace("{count}", String(resetState.cleared))}
                        </span>
                      )}
                      {resetState?.kind === "error" && (
                        <span className="text-(--red)">{resetState.message}</span>
                      )}
                    </div>
                  </div>
                </section>
                </>
              ),
            },
          ]}
        />
      </div>
    </main>
  );
}

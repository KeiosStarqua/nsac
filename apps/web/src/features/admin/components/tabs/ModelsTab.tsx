import { useEffect, useMemo, useState } from "react";
import { useCopy } from "~/shared/i18n";
import { adminModelFn, setAgentConfigFn } from "../../api/admin.functions";
import type { AgentModelsSetting } from "../../api/admin.functions";
import type { PickerModel } from "../../model/catalog";
import { goAsPickerModels, bedrockAsPickerModels } from "../../model/catalog";
import type { AgentProvider } from "../../../agent/runtime/agent-model.server";
import { useAdminGate } from "../admin-gate";
import { buttonClasses, inputClasses, mono, muted } from "./classes";

type ApplyState = { kind: "ok" } | { kind: "error"; message: string } | null;
type EffectiveModels = {
  default: string;
  chat: string;
  orchestrator: string;
  "generative-ui": string;
  "hud-composer": string;
};

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

export function ModelsTab() {
  const copy = useCopy().admin;
  const { lock } = useAdminGate();

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
        lock();
      }
    } catch {
      setOpenrouterModels([]);
      setOpenrouterOk(false);
    } finally {
      setLoadingModels(false);
    }
  }

  useEffect(() => {
    void loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        lock();
      }
    } catch {
      setApplyState({ kind: "error", message: copy.applyFailed });
    } finally {
      setApplying(false);
    }
  }

  const selectClasses = `${inputClasses} cursor-pointer`;
  const effectiveLine = copy.effectiveLine
    .replace("{model}", effectiveModels?.default ?? "…")
    .replace("{provider}", effectiveProvider);

  return (
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
  );
}

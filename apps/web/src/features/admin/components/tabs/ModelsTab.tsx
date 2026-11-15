import { useEffect, useMemo, useState } from "react";
import { useCopy } from "~/shared/i18n";
import { adminModelFn, setAgentConfigFn } from "../../api/admin.functions";
import type { AgentModelsSetting } from "../../api/admin.functions";
import type { PickerModel } from "../../model/catalog";
import { goAsPickerModels, bedrockAsPickerModels } from "../../model/catalog";
import { filterModelIds, sanitizeProfileModels } from "../../model/catalogFilter";
import type { AgentProvider } from "../../../agent/runtime/agent-model.server";
import { useAdminGate } from "../admin-gate";
import { Gauge, Server, SlidersHorizontal } from "lucide-react";
import {
  buttonClasses,
  labelClasses,
  mono,
  muted,
  sectionCard,
  sectionHeader,
  sectionIcon,
  sectionTitle,
  selectClasses,
} from "./classes";

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

/** Short provider name for the section kicker + scoped-catalog caption (brand names, locale-neutral). */
const PROVIDER_DISPLAY: Record<AgentProvider, string> = {
  "opencode-go": "OpenCode Go",
  openrouter: "OpenRouter",
  "amazon-bedrock": "AWS Bedrock",
};

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
  const [droppedForeign, setDroppedForeign] = useState<number>(0);
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
        const storedProvider = r.provider;
        const storedCatalog =
          storedProvider === "opencode-go"
            ? goModels
            : storedProvider === "amazon-bedrock"
              ? bedrockModels
              : r.openrouterModels;
        // OpenRouter's catalog is fetched live; when that fetch failed the membership is unknown.
        const catalogKnown = storedProvider !== "openrouter" || r.openrouterOk;
        let nextDefault = r.setting?.model ?? "";
        let nextProfiles: Record<string, string> = {
          "sky-chat": r.setting?.models?.["sky-chat"] ?? "",
          "sky-orchestrator": r.setting?.models?.["sky-orchestrator"] ?? "",
          "sky-generative-ui": r.setting?.models?.["sky-generative-ui"] ?? "",
          "sky-hud-composer": r.setting?.models?.["sky-hud-composer"] ?? "",
        };
        if (catalogKnown) {
          // Never keep an id the stored provider cannot serve — it would render as a foreign option.
          nextDefault = filterModelIds(storedCatalog, [nextDefault]).kept[0] ?? "";
          nextProfiles = sanitizeProfileModels(storedCatalog, nextProfiles).models;
        }
        setProvider(storedProvider);
        setEffectiveProvider(storedProvider);
        setProviderSource(r.providerSource);
        setEffectiveModels(r.effectiveModels);
        setSetting(r.setting);
        setOpenrouterModels(r.openrouterModels);
        setOpenrouterOk(r.openrouterOk);
        setDefaultModel(nextDefault);
        setProfileModels(nextProfiles);
        setDroppedForeign(0);
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

  // Switching provider re-scopes the picks: every id the new catalog cannot serve is dropped.
  function onProviderChange(next: AgentProvider) {
    setProvider(next);
    setDroppedForeign(0);
    setApplyState(null);
    // OpenRouter's catalog is live; when it is unavailable the membership is unknown — leave picks alone.
    if (next === "openrouter" && !openrouterOk) return;
    const nextCatalog =
      next === "opencode-go" ? goModels : next === "amazon-bedrock" ? bedrockModels : openrouterModels;
    const defaultDropped = filterModelIds(nextCatalog, [defaultModel]).dropped.length;
    if (defaultDropped > 0) setDefaultModel("");
    const profiles = sanitizeProfileModels(nextCatalog, profileModels);
    setProfileModels(profiles.models);
    const dropped = defaultDropped + profiles.dropped;
    if (dropped > 0) setDroppedForeign(dropped);
  }

  async function apply() {
    if (applying) return;
    setApplying(true);
    setDroppedForeign(0);
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

  return (
    <div className="flex flex-col gap-4">
      {/* Effective configuration — what Sky will actually run */}
      <section aria-label={copy.currentEffective} className={sectionCard}>
        <div className={sectionHeader}>
          <h2 className={sectionTitle}>
            <Gauge aria-hidden className={sectionIcon} strokeWidth={1.75} />
            {copy.currentEffective}
          </h2>
        </div>
        <dl className={`${mono} mt-2.5 grid grid-cols-[max-content_1fr] gap-x-5 gap-y-1 text-[12px] leading-6`}>
          <dt className={muted}>provider</dt>
          <dd className="break-words">
            {effectiveProvider}{" "}
            <span className={`${muted} whitespace-nowrap`}>({providerSource})</span>
          </dd>
          <dt className={muted}>default</dt>
          <dd className="break-all">{effectiveModels?.default ?? "…"}</dd>
          <dt className={muted}>sky-chat</dt>
          <dd className="break-all">{effectiveModels?.chat ?? "…"}</dd>
          <dt className={muted}>sky-orchestrator</dt>
          <dd className="break-all">{effectiveModels?.orchestrator ?? "…"}</dd>
          <dt className={muted}>sky-generative-ui</dt>
          <dd className="break-all">{effectiveModels?.["generative-ui"] ?? "…"}</dd>
          <dt className={muted}>sky-hud-composer</dt>
          <dd className="break-all">{effectiveModels?.["hud-composer"] ?? "…"}</dd>
        </dl>
        <div className={`${muted} mt-2.5 text-[12px] leading-5`}>
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
        <div className={`${muted} mt-1 text-[12px] leading-5`}>{copy.appliesNote}</div>
      </section>

      {/* Provider */}
      <section aria-label={copy.providerLabel} className={sectionCard}>
        <div className={sectionHeader}>
          <h2 className={sectionTitle}>
            <Server aria-hidden className={sectionIcon} strokeWidth={1.75} />
            {copy.providerLabel}
          </h2>
        </div>
        <label htmlFor="admin-provider" className={`${labelClasses} mt-2.5`}>
          {copy.providerLabel}
        </label>
        <select
          id="admin-provider"
          value={provider}
          onChange={(e) => onProviderChange(e.target.value as AgentProvider)}
          className={selectClasses}
        >
          <option value="opencode-go">{copy.providerOpencodeGo}</option>
          <option value="openrouter">{copy.providerOpenrouter}</option>
          <option value="amazon-bedrock">{copy.providerAmazonBedrock}</option>
        </select>
        <p className={`${muted} mt-1.5 text-[12px] leading-5`}>
          {provider === "opencode-go"
            ? copy.providerOpencodeGoDesc
            : provider === "amazon-bedrock"
              ? copy.providerAmazonBedrockDesc
              : copy.providerOpenrouterDesc}
        </p>
        {provider === "amazon-bedrock" && (
          <p className={`${muted} mt-1 text-[12px] leading-5`}>{copy.bedrockVerifiedNote}</p>
        )}
        {provider === "amazon-bedrock" && (
          <p className={`${muted} mt-1 text-[12px] leading-5`}>{copy.bedrockKeyNote}</p>
        )}
        {provider === "openrouter" && (
          <p className={`${muted} mt-1 text-[12px] leading-5`}>{copy.legacyNote}</p>
        )}
        {droppedForeign > 0 && (
          <p role="status" className={`${muted} mt-2 text-[12px] leading-5`}>
            {copy.modelsDroppedForeign.replace("{count}", String(droppedForeign))}
          </p>
        )}
        {!catalogReady && (
          <p role="alert" className="mt-2 text-[14px] text-(--yellow)">
            {copy.catalogError}
          </p>
        )}
      </section>

      {/* Model picks */}
      <section
        aria-label={copy.modelsSectionKicker.replace("{provider}", PROVIDER_DISPLAY[provider])}
        className={sectionCard}
      >
        <div className={sectionHeader}>
          <h2 className={sectionTitle}>
            <SlidersHorizontal aria-hidden className={sectionIcon} strokeWidth={1.75} />
            {copy.modelsSectionKicker.replace("{provider}", PROVIDER_DISPLAY[provider])}
          </h2>
        </div>
        <p className={`${muted} mt-1.5 text-[12px] leading-5`}>
          {copy.catalogScopedNote.replace("{provider}", PROVIDER_DISPLAY[provider])}
        </p>

        {/* Default (all agents) */}
        <label htmlFor="admin-default-model" className={`${labelClasses} mt-3`}>
          {copy.defaultAllLabel}
        </label>
        <p className={`${muted} mb-1.5 text-[12px] leading-5`}>{copy.defaultAllHint}</p>
        <select
          id="admin-default-model"
          value={defaultModel}
          onChange={(e) => setDefaultModel(e.target.value)}
          className={selectClasses}
          disabled={loadingModels}
        >
          <option value="">{copy.inheritDefault}</option>
          {catalog.map((m) => (
            <option key={m.id} value={m.id}>
              {modelOptionLabel(m)}
            </option>
          ))}
        </select>

        {/* Per-profile overrides */}
        {profileFields.map((field) => (
          <div key={field.id} className="mt-3.5">
            <label htmlFor={`admin-model-${field.id}`} className="block text-[14px]">
              {field.label}
            </label>
            <p className={`${muted} mt-0.5 mb-1.5 text-[12px] leading-5`}>{field.hint}</p>
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
              {catalog.map((m) => (
                <option key={m.id} value={m.id}>
                  {modelOptionLabel(m)}
                </option>
              ))}
            </select>
          </div>
        ))}

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-(--border-subtle) pt-4">
          <button
            type="button"
            onClick={apply}
            disabled={applying || loadingModels || !catalogReady}
            className={buttonClasses}
          >
            {applying ? copy.applying : copy.apply}
          </button>
          <div aria-live="polite" className="text-[14px]">
            {applyState?.kind === "ok" && <span className="text-(--green)">{copy.saved}</span>}
            {applyState?.kind === "error" && <span className="text-(--red)">{applyState.message}</span>}
          </div>
        </div>
      </section>
    </div>
  );
}

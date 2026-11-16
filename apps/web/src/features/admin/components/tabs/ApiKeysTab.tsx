import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Activity, Cloud, KeyRound, Volume2, type LucideIcon } from "lucide-react";
import { useCopy } from "~/shared/i18n";
import {
  getOpenCodeKeyInfoFn,
  saveOpenCodeKeyFn,
  clearOpenCodeKeyFn,
} from "../../api/opencode-key.functions";
import {
  getBedrockKeyInfoFn,
  saveBedrockKeyFn,
  clearBedrockKeyFn,
} from "../../api/bedrock-key.functions";
import {
  getElevenLabsStatusFn,
  setElevenLabsKeyFn,
  clearElevenLabsKeyFn,
} from "../../api/elevenlabs.functions";
import {
  getLangfuseStatusFn,
  saveLangfuseKeyFn,
  clearLangfuseKeyFileFn,
} from "../../api/langfuse-key.functions";
import { useAdminGate } from "../admin-gate";
import {
  buttonClasses,
  dangerButtonClasses,
  ghostButtonClasses,
  inputClasses,
  labelClasses,
  mono,
  muted,
  sectionCard,
  sectionHeader,
  sectionIcon,
  sectionTitle,
  statusDot,
  statusPill,
} from "./classes";

// Write-only key panels. Three providers, one card each, same anatomy:
// header (icon · title · status pill) → form (label · password field · actions) → footnote.
// The stored value never comes back to this page — only presence + updatedAt.

const GO_KEY_REGEX = /^[!-~]{8,512}$/;
const BEDROCK_TOKEN_REGEX = /^[!-~]{8,4096}$/;
const ELEVENLABS_KEY_REGEX = /^[A-Za-z0-9_-]{10,512}$/;
// Mirrors the Langfuse store: pk-/sk- prefix + URL-safe characters, and an https endpoint
// (`http` only for a loopback dev instance), no credentials in the URL.
const LANGFUSE_PUBLIC_KEY_REGEX = /^pk-[A-Za-z0-9_-]{4,228}$/;
const LANGFUSE_SECRET_KEY_REGEX = /^sk-[A-Za-z0-9_-]{4,228}$/;
const LANGFUSE_LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function langfuseUrlValid(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 200) return false;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }
  if (url.username !== "" || url.password !== "") return false;
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && LANGFUSE_LOCAL_HOSTS.has(url.hostname);
}

type FileKeySource = "env" | "file" | "none";
type KeyFeedback = { kind: "ok" | "error"; message: string } | null;

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={statusPill(ok ? "ok" : "mute")}>
      <span aria-hidden className={statusDot(ok ? "ok" : "mute")} />
      {label}
    </span>
  );
}

function KeySection({
  icon: Icon,
  title,
  status,
  hint,
  note,
  children,
}: {
  icon: LucideIcon;
  title: string;
  status: { ok: boolean; label: string };
  hint?: string | null;
  note: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className={sectionCard}>
      <div className={sectionHeader}>
        <h2 className={sectionTitle}>
          <Icon aria-hidden className={sectionIcon} strokeWidth={1.75} />
          {title}
        </h2>
        {status.label && <StatusPill ok={status.ok} label={status.label} />}
      </div>
      {hint && <p className={`${muted} mt-2 text-[12px] leading-5`}>{hint}</p>}
      {children}
      <p className={`${muted} mt-3 border-t border-(--border-subtle) pt-3 text-[12px] leading-5`}>{note}</p>
    </section>
  );
}

function KeyActions({
  busy,
  clearBusy,
  confirmClear,
  canSave,
  onSave,
  onClearRequest,
  onClearConfirm,
  onClearCancel,
  saveLabel,
  savingLabel,
  clearLabel,
  clearConfirmLabel,
  clearCancelLabel,
  clearingLabel,
  feedback,
}: {
  busy: boolean;
  clearBusy: boolean;
  confirmClear: boolean;
  canSave: boolean;
  onSave: () => void;
  onClearRequest: () => void;
  onClearConfirm: () => void;
  onClearCancel: () => void;
  saveLabel: string;
  savingLabel: string;
  clearLabel: string;
  clearConfirmLabel: string;
  clearCancelLabel: string;
  clearingLabel: string;
  feedback: KeyFeedback;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2.5">
      <button type="submit" disabled={busy || !canSave} className={buttonClasses}>
        {busy ? savingLabel : saveLabel}
      </button>
      {confirmClear ? (
        <>
          <button type="button" onClick={onClearConfirm} disabled={clearBusy} className={dangerButtonClasses}>
            {clearBusy ? clearingLabel : clearConfirmLabel}
          </button>
          <button type="button" onClick={onClearCancel} disabled={clearBusy} className={ghostButtonClasses}>
            {clearCancelLabel}
          </button>
        </>
      ) : (
        <button type="button" onClick={onClearRequest} disabled={clearBusy} className={ghostButtonClasses}>
          {clearLabel}
        </button>
      )}
      <div aria-live="polite" className="text-[14px]">
        {feedback?.kind === "ok" && <span className="text-(--green)">{feedback.message}</span>}
        {feedback?.kind === "error" && <span className="text-(--red)">{feedback.message}</span>}
      </div>
    </div>
  );
}

const passwordField = (id: string) =>
  ({
    id,
    type: "password" as const,
    autoComplete: "off" as const,
    spellCheck: false,
    className: inputClasses,
  });

export function ApiKeysTab() {
  const copy = useCopy().admin;
  const { lock } = useAdminGate();

  // ---- OpenCode Go (agent) --------------------------------------------------
  const [goStatus, setGoStatus] = useState<{ source: FileKeySource; updatedAt: number | null } | undefined>(undefined);
  const [goKey, setGoKey] = useState("");
  const [goBusy, setGoBusy] = useState(false);
  const [goClearBusy, setGoClearBusy] = useState(false);
  const [goConfirmClear, setGoConfirmClear] = useState(false);
  const [goFeedback, setGoFeedback] = useState<KeyFeedback>(null);

  // ---- AWS Bedrock -----------------------------------------------------------
  const [bedrockStatus, setBedrockStatus] = useState<{ source: FileKeySource; updatedAt: number | null } | undefined>(undefined);
  const [bedrockKey, setBedrockKey] = useState("");
  const [bedrockBusy, setBedrockBusy] = useState(false);
  const [bedrockClearBusy, setBedrockClearBusy] = useState(false);
  const [bedrockConfirmClear, setBedrockConfirmClear] = useState(false);
  const [bedrockFeedback, setBedrockFeedback] = useState<KeyFeedback>(null);

  // ---- ElevenLabs (Sky TTS) --------------------------------------------------
  const [elevenStatus, setElevenStatus] = useState<{ configured: boolean; updatedAt: number | null } | undefined>(undefined);
  const [elevenKey, setElevenKey] = useState("");
  const [elevenBusy, setElevenBusy] = useState(false);
  const [elevenClearBusy, setElevenClearBusy] = useState(false);
  const [elevenConfirmClear, setElevenConfirmClear] = useState(false);
  const [elevenFeedback, setElevenFeedback] = useState<KeyFeedback>(null);

  // ---- Langfuse (Mastra tracing) ---------------------------------------------
  const [langfuseStatus, setLangfuseStatus] = useState<
    { source: FileKeySource; updatedAt: number | null; baseUrl: string | null } | undefined
  >(undefined);
  const [langfuseUrl, setLangfuseUrl] = useState("");
  const [langfusePublicKey, setLangfusePublicKey] = useState("");
  const [langfuseSecretKey, setLangfuseSecretKey] = useState("");
  const [langfuseBusy, setLangfuseBusy] = useState(false);
  const [langfuseClearBusy, setLangfuseClearBusy] = useState(false);
  const [langfuseConfirmClear, setLangfuseConfirmClear] = useState(false);
  const [langfuseFeedback, setLangfuseFeedback] = useState<KeyFeedback>(null);

  useEffect(() => {
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
    getBedrockKeyInfoFn()
      .then((r) => {
        if (!cancelled) {
          setBedrockStatus(r.status === "ok" ? { source: r.source, updatedAt: r.updatedAt } : { source: "none", updatedAt: null });
        }
      })
      .catch(() => {
        if (!cancelled) setBedrockStatus({ source: "none", updatedAt: null });
      });
    getElevenLabsStatusFn()
      .then((r) => {
        if (!cancelled) setElevenStatus(r);
      })
      .catch(() => {
        if (!cancelled) setElevenStatus({ configured: false, updatedAt: null });
      });
    getLangfuseStatusFn()
      .then((r) => {
        if (!cancelled) {
          setLangfuseStatus(
            r.status === "ok"
              ? { source: r.source, updatedAt: r.updatedAt, baseUrl: r.baseUrl }
              : { source: "none", updatedAt: null, baseUrl: null },
          );
        }
      })
      .catch(() => {
        if (!cancelled) setLangfuseStatus({ source: "none", updatedAt: null, baseUrl: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshGoStatus() {
    try {
      const r = await getOpenCodeKeyInfoFn();
      setGoStatus(r.status === "ok" ? { source: r.source, updatedAt: r.updatedAt } : { source: "none", updatedAt: null });
    } catch {
      setGoStatus({ source: "none", updatedAt: null });
    }
  }

  async function refreshBedrockStatus() {
    try {
      const r = await getBedrockKeyInfoFn();
      setBedrockStatus(r.status === "ok" ? { source: r.source, updatedAt: r.updatedAt } : { source: "none", updatedAt: null });
    } catch {
      setBedrockStatus({ source: "none", updatedAt: null });
    }
  }

  async function saveGoKey() {
    const trimmed = goKey.trim();
    if (!GO_KEY_REGEX.test(trimmed) || goBusy) return;
    setGoBusy(true);
    setGoFeedback(null);
    try {
      const r = await saveOpenCodeKeyFn({ data: { key: trimmed } });
      if (r.status === "ok") {
        setGoKey("");
        await refreshGoStatus();
        setGoFeedback({ kind: "ok", message: copy.goKeySaved });
      } else if (r.status === "invalid_key") {
        setGoFeedback({ kind: "error", message: copy.goKeyInvalidKey });
      } else if (r.status === "unauthorized") {
        lock();
      } else {
        setGoFeedback({ kind: "error", message: copy.goKeySaveFailed });
      }
    } catch {
      setGoFeedback({ kind: "error", message: copy.goKeySaveFailed });
    } finally {
      setGoBusy(false);
    }
  }

  async function clearGoKey() {
    if (goClearBusy) return;
    setGoClearBusy(true);
    setGoFeedback(null);
    try {
      const r = await clearOpenCodeKeyFn();
      if (r.status === "ok") {
        await refreshGoStatus();
        setGoFeedback({ kind: "ok", message: copy.goKeyClearDone });
      } else {
        lock();
      }
    } catch {
      setGoFeedback({ kind: "error", message: copy.goKeyClearFailed });
    } finally {
      setGoClearBusy(false);
      setGoConfirmClear(false);
    }
  }

  async function saveBedrockKey() {
    const trimmed = bedrockKey.trim();
    if (!BEDROCK_TOKEN_REGEX.test(trimmed) || bedrockBusy) return;
    setBedrockBusy(true);
    setBedrockFeedback(null);
    try {
      const r = await saveBedrockKeyFn({ data: { key: trimmed } });
      if (r.status === "ok") {
        setBedrockKey("");
        await refreshBedrockStatus();
        setBedrockFeedback({ kind: "ok", message: copy.bedrockSaved });
      } else if (r.status === "invalid_key") {
        setBedrockFeedback({ kind: "error", message: copy.bedrockInvalidKey });
      } else if (r.status === "unauthorized") {
        lock();
      } else {
        setBedrockFeedback({ kind: "error", message: copy.bedrockSaveFailed });
      }
    } catch {
      setBedrockFeedback({ kind: "error", message: copy.bedrockSaveFailed });
    } finally {
      setBedrockBusy(false);
    }
  }

  async function clearBedrockKey() {
    if (bedrockClearBusy) return;
    setBedrockClearBusy(true);
    setBedrockFeedback(null);
    try {
      const r = await clearBedrockKeyFn();
      if (r.status === "ok") {
        await refreshBedrockStatus();
        setBedrockFeedback({ kind: "ok", message: copy.bedrockClearDone });
      } else {
        lock();
      }
    } catch {
      setBedrockFeedback({ kind: "error", message: copy.bedrockClearFailed });
    } finally {
      setBedrockClearBusy(false);
      setBedrockConfirmClear(false);
    }
  }

  async function saveElevenLabsKey() {
    const trimmed = elevenKey.trim();
    if (!ELEVENLABS_KEY_REGEX.test(trimmed) || elevenBusy) return;
    setElevenBusy(true);
    setElevenFeedback(null);
    try {
      const r = await setElevenLabsKeyFn({ data: { key: trimmed } });
      if (r.status === "ok") {
        setElevenKey("");
        setElevenStatus({ configured: true, updatedAt: r.updatedAt });
        setElevenFeedback({ kind: "ok", message: copy.elevenlabsSaved });
      } else if (r.status === "invalid_key") {
        setElevenFeedback({ kind: "error", message: copy.elevenlabsInvalidKey });
      } else if (r.status === "backend_error") {
        setElevenFeedback({ kind: "error", message: copy.elevenlabsSaveFailed });
      } else {
        lock();
      }
    } catch {
      setElevenFeedback({ kind: "error", message: copy.elevenlabsSaveFailed });
    } finally {
      setElevenBusy(false);
    }
  }

  async function clearElevenLabsKey() {
    if (elevenClearBusy) return;
    setElevenClearBusy(true);
    setElevenFeedback(null);
    try {
      const r = await clearElevenLabsKeyFn();
      if (r.status === "ok") {
        setElevenStatus({ configured: false, updatedAt: null });
        setElevenFeedback({ kind: "ok", message: copy.elevenlabsClearDone });
      } else if (r.status === "unauthorized") {
        lock();
      } else {
        setElevenFeedback({ kind: "error", message: copy.elevenlabsClearFailed });
      }
    } catch {
      setElevenFeedback({ kind: "error", message: copy.elevenlabsClearFailed });
    } finally {
      setElevenClearBusy(false);
      setElevenConfirmClear(false);
    }
  }

  async function refreshLangfuseStatus() {
    try {
      const r = await getLangfuseStatusFn();
      setLangfuseStatus(
        r.status === "ok"
          ? { source: r.source, updatedAt: r.updatedAt, baseUrl: r.baseUrl }
          : { source: "none", updatedAt: null, baseUrl: null },
      );
    } catch {
      setLangfuseStatus({ source: "none", updatedAt: null, baseUrl: null });
    }
  }

  const langfuseComplete =
    LANGFUSE_PUBLIC_KEY_REGEX.test(langfusePublicKey.trim()) &&
    LANGFUSE_SECRET_KEY_REGEX.test(langfuseSecretKey.trim()) &&
    langfuseUrlValid(langfuseUrl);

  async function saveLangfuseKeys() {
    const publicKey = langfusePublicKey.trim();
    const secretKey = langfuseSecretKey.trim();
    const baseUrl = langfuseUrl.trim();
    if (
      !LANGFUSE_PUBLIC_KEY_REGEX.test(publicKey) ||
      !LANGFUSE_SECRET_KEY_REGEX.test(secretKey) ||
      !langfuseUrlValid(baseUrl) ||
      langfuseBusy
    ) {
      return;
    }
    setLangfuseBusy(true);
    setLangfuseFeedback(null);
    try {
      const r = await saveLangfuseKeyFn({ data: { publicKey, secretKey, baseUrl } });
      if (r.status === "ok") {
        setLangfuseUrl("");
        setLangfusePublicKey("");
        setLangfuseSecretKey("");
        await refreshLangfuseStatus();
        setLangfuseFeedback({ kind: "ok", message: copy.langfuseSaved });
      } else if (r.status === "invalid_public_key") {
        setLangfuseFeedback({ kind: "error", message: copy.langfuseInvalidPublicKey });
      } else if (r.status === "invalid_secret_key") {
        setLangfuseFeedback({ kind: "error", message: copy.langfuseInvalidSecretKey });
      } else if (r.status === "invalid_base_url") {
        setLangfuseFeedback({ kind: "error", message: copy.langfuseInvalidUrl });
      } else if (r.status === "unauthorized") {
        lock();
      } else {
        setLangfuseFeedback({ kind: "error", message: copy.langfuseSaveFailed });
      }
    } catch {
      setLangfuseFeedback({ kind: "error", message: copy.langfuseSaveFailed });
    } finally {
      setLangfuseBusy(false);
    }
  }

  async function clearLangfuseKeys() {
    if (langfuseClearBusy) return;
    setLangfuseClearBusy(true);
    setLangfuseFeedback(null);
    try {
      const r = await clearLangfuseKeyFileFn();
      if (r.status === "ok") {
        await refreshLangfuseStatus();
        setLangfuseFeedback({ kind: "ok", message: copy.langfuseClearDone });
      } else {
        lock();
      }
    } catch {
      setLangfuseFeedback({ kind: "error", message: copy.langfuseClearFailed });
    } finally {
      setLangfuseClearBusy(false);
      setLangfuseConfirmClear(false);
    }
  }

  const goStatusLabel =
    goStatus == null
      ? copy.checking
      : goStatus.source === "env"
        ? copy.goKeyConfiguredEnv
        : goStatus.source === "file"
          ? copy.goKeyConfiguredFile
          : copy.goKeyNotConfigured;
  const bedrockStatusLabel =
    bedrockStatus == null
      ? copy.checking
      : bedrockStatus.source === "env"
        ? copy.bedrockConfiguredEnv
        : bedrockStatus.source === "file"
          ? copy.bedrockConfiguredFile
          : copy.bedrockNotConfigured;
  const langfuseStatusLabel =
    langfuseStatus == null
      ? copy.checking
      : langfuseStatus.source === "env"
        ? copy.langfuseConfiguredEnv
        : langfuseStatus.source === "file"
          ? copy.langfuseConfiguredFile
          : copy.langfuseNotConfigured;

  return (
    <div className="flex flex-col gap-4">
      <p className={`${muted} max-w-[72ch] text-[14px] leading-5`}>{copy.keysIntro}</p>

      {/* OpenCode Go — the production agent provider */}
      <KeySection
        icon={KeyRound}
        title={copy.goKeyTitle}
        status={{ ok: goStatus != null && goStatus.source !== "none", label: goStatusLabel }}
        hint={goStatus?.source === "env" ? copy.goKeyEnvHint : null}
        note={copy.goKeyNote}
      >
        <form
          className="mt-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void saveGoKey();
          }}
        >
          <label htmlFor="sky-opencode-key" className={labelClasses}>
            {copy.goKeyLabel}
          </label>
          <input
            {...passwordField("sky-opencode-key")}
            placeholder={goStatus?.source === "file" ? copy.goKeyPlaceholderStored : copy.goKeyPlaceholder}
            value={goKey}
            onChange={(e) => setGoKey(e.target.value)}
          />
          <KeyActions
            busy={goBusy}
            clearBusy={goClearBusy}
            confirmClear={goConfirmClear}
            canSave={GO_KEY_REGEX.test(goKey.trim())}
            onSave={() => void saveGoKey()}
            onClearRequest={() => setGoConfirmClear(true)}
            onClearConfirm={() => void clearGoKey()}
            onClearCancel={() => setGoConfirmClear(false)}
            saveLabel={copy.goKeySave}
            savingLabel={copy.goKeySaving}
            clearLabel={copy.goKeyClear}
            clearConfirmLabel={copy.goKeyClearConfirm}
            clearCancelLabel={copy.goKeyClearCancel}
            clearingLabel={copy.goKeyClearing}
            feedback={goFeedback}
          />
        </form>
      </KeySection>

      {/* AWS Bedrock — same write-only contract, region pinned */}
      <KeySection
        icon={Cloud}
        title={copy.bedrockTitle}
        status={{ ok: bedrockStatus != null && bedrockStatus.source !== "none", label: bedrockStatusLabel }}
        hint={bedrockStatus?.source === "env" ? copy.bedrockEnvHint : null}
        note={copy.bedrockNote}
      >
        <form
          className="mt-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void saveBedrockKey();
          }}
        >
          <label htmlFor="sky-bedrock-token" className={labelClasses}>
            {copy.bedrockTokenLabel}
          </label>
          <input
            {...passwordField("sky-bedrock-token")}
            placeholder={bedrockStatus?.source === "file" ? copy.bedrockPlaceholderStored : copy.bedrockPlaceholder}
            value={bedrockKey}
            onChange={(e) => setBedrockKey(e.target.value)}
          />
          <KeyActions
            busy={bedrockBusy}
            clearBusy={bedrockClearBusy}
            confirmClear={bedrockConfirmClear}
            canSave={BEDROCK_TOKEN_REGEX.test(bedrockKey.trim())}
            onSave={() => void saveBedrockKey()}
            onClearRequest={() => setBedrockConfirmClear(true)}
            onClearConfirm={() => void clearBedrockKey()}
            onClearCancel={() => setBedrockConfirmClear(false)}
            saveLabel={copy.bedrockSave}
            savingLabel={copy.bedrockSaving}
            clearLabel={copy.bedrockClear}
            clearConfirmLabel={copy.bedrockClearConfirm}
            clearCancelLabel={copy.bedrockClearCancel}
            clearingLabel={copy.bedrockClearing}
            feedback={bedrockFeedback}
          />
        </form>
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[12px] leading-5">
          <div className="flex items-baseline gap-2">
            <dt className={muted}>{copy.bedrockRegionLabel}</dt>
            <dd className={mono}>ap-southeast-1</dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className={muted}>{copy.bedrockProviderHintLabel}</dt>
            <dd className="text-(--text)">{copy.bedrockProviderHint}</dd>
          </div>
        </dl>
      </KeySection>

      {/* ElevenLabs — Sky TTS */}
      <KeySection
        icon={Volume2}
        title={copy.elevenlabsTitle}
        status={{
          ok: elevenStatus != null && elevenStatus.configured,
          label: elevenStatus == null ? copy.checking : elevenStatus.configured ? copy.elevenlabsConfigured : copy.elevenlabsNotConfigured,
        }}
        note={copy.elevenlabsNote}
      >
        <form
          className="mt-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void saveElevenLabsKey();
          }}
        >
          <label htmlFor="sky-elevenlabs-key" className={labelClasses}>
            {copy.elevenlabsKeyLabel}
          </label>
          <input
            {...passwordField("sky-elevenlabs-key")}
            placeholder="sk_…"
            value={elevenKey}
            onChange={(e) => setElevenKey(e.target.value)}
          />
          <KeyActions
            busy={elevenBusy}
            clearBusy={elevenClearBusy}
            confirmClear={elevenConfirmClear}
            canSave={ELEVENLABS_KEY_REGEX.test(elevenKey.trim())}
            onSave={() => void saveElevenLabsKey()}
            onClearRequest={() => setElevenConfirmClear(true)}
            onClearConfirm={() => void clearElevenLabsKey()}
            onClearCancel={() => setElevenConfirmClear(false)}
            saveLabel={copy.elevenlabsSave}
            savingLabel={copy.elevenlabsSaving}
            clearLabel={copy.elevenlabsClear}
            clearConfirmLabel={copy.elevenlabsClearConfirm}
            clearCancelLabel={copy.elevenlabsClearCancel}
            clearingLabel={copy.elevenlabsClearing}
            feedback={elevenFeedback}
          />
        </form>
      </KeySection>

      {/* Langfuse — Mastra tracing; the whole triple is written atomically */}
      <KeySection
        icon={Activity}
        title={copy.langfuseTitle}
        status={{
          ok: langfuseStatus != null && langfuseStatus.source !== "none",
          label: langfuseStatusLabel,
        }}
        hint={langfuseStatus?.source === "env" ? copy.langfuseEnvHint : null}
        note={copy.langfuseNote}
      >
        <form
          className="mt-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void saveLangfuseKeys();
          }}
        >
          <div>
            <label htmlFor="sky-langfuse-base" className={labelClasses}>
              {copy.langfuseUrlLabel}
            </label>
            <input
              id="sky-langfuse-base"
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              className={inputClasses}
              placeholder={copy.langfuseUrlPlaceholder}
              value={langfuseUrl}
              onChange={(e) => setLangfuseUrl(e.target.value)}
            />
          </div>
          <div className="mt-3">
            <label htmlFor="sky-langfuse-public-key" className={labelClasses}>
              {copy.langfusePublicKeyLabel}
            </label>
            <input
              id="sky-langfuse-public-key"
              type="text"
              autoComplete="off"
              spellCheck={false}
              className={inputClasses}
              placeholder={
                langfuseStatus?.source === "file" ? copy.langfusePlaceholderStored : copy.langfusePublicKeyPlaceholder
              }
              value={langfusePublicKey}
              onChange={(e) => setLangfusePublicKey(e.target.value)}
            />
          </div>
          <div className="mt-3">
            <label htmlFor="sky-langfuse-secret-key" className={labelClasses}>
              {copy.langfuseSecretKeyLabel}
            </label>
            <input
              {...passwordField("sky-langfuse-secret-key")}
              placeholder={
                langfuseStatus?.source === "file" ? copy.langfusePlaceholderStored : copy.langfuseSecretKeyPlaceholder
              }
              value={langfuseSecretKey}
              onChange={(e) => setLangfuseSecretKey(e.target.value)}
            />
          </div>
          <KeyActions
            busy={langfuseBusy}
            clearBusy={langfuseClearBusy}
            confirmClear={langfuseConfirmClear}
            canSave={langfuseComplete}
            onSave={() => void saveLangfuseKeys()}
            onClearRequest={() => setLangfuseConfirmClear(true)}
            onClearConfirm={() => void clearLangfuseKeys()}
            onClearCancel={() => setLangfuseConfirmClear(false)}
            saveLabel={copy.langfuseSave}
            savingLabel={copy.langfuseSaving}
            clearLabel={copy.langfuseClear}
            clearConfirmLabel={copy.langfuseClearConfirm}
            clearCancelLabel={copy.langfuseClearCancel}
            clearingLabel={copy.langfuseClearing}
            feedback={langfuseFeedback}
          />
        </form>
        {langfuseStatus?.source === "file" && langfuseStatus.baseUrl && (
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[12px] leading-5">
            <div className="flex min-w-0 items-baseline gap-2">
              <dt className={muted}>{copy.langfuseEndpointLabel}</dt>
              <dd className={`${mono} truncate`}>{langfuseStatus.baseUrl}</dd>
            </div>
          </dl>
        )}
      </KeySection>
    </div>
  );
}

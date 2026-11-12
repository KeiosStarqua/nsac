import * as Dialog from "@radix-ui/react-dialog";
import { Renderer, type ActionEvent } from "@openuidev/react-lang";
import { useCallback, useMemo, useState } from "react";
import { Button } from "~/components/arc/button/button";
import { useCopy, useLocale } from "~/shared/i18n";
import { saveOpenRouterKeyFn } from "../api/key.functions";
import { PanelScopeProvider } from "../catalog/library";
import { keyPanelLibrary } from "../catalog/key-panel";
import { keyPanelProgram } from "../model/key-panel";
import styles from "./OpenRouterKeyDialog.module.css";

/**
 * The dialog Sky shows when it needs an OpenRouter key to compose a panel and none is saved.
 * The panel itself is OpenUI Lang from `keyPanelProgram` — the interface is OpenUI, the way every
 * Sky surface is. The key is write-only: it goes to the server once and never comes back.
 */
export function OpenRouterKeyDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a key was saved; the parent closes the dialog and lets the panels retry. */
  onSaved: () => void;
}) {
  const copy = useCopy();
  const locale = useLocale();
  const t = copy.sky.keyDialog;
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Rebuilt per locale; keyed by it on the Renderer so a language switch starts a fresh panel.
  const program = useMemo(
    () =>
      keyPanelProgram({
        title: t.title,
        cardTitle: t.cardTitle,
        body: t.body,
        fieldLabel: t.fieldLabel,
        saveLabel: t.saveLabel,
        note: t.note,
      }),
    [t],
  );

  const submit = useCallback(
    async (key: string) => {
      setSaving(true);
      setError(null);
      try {
        const result = await saveOpenRouterKeyFn({ data: { key } });
        if (result.ok) {
          onSaved();
          return;
        }
        setError(result.problem === "invalid" ? t.errorInvalid : t.errorIo);
      } catch {
        setError(t.errorIo);
      } finally {
        setSaving(false);
      }
    },
    [onSaved, t],
  );

  const handleAction = useCallback(
    (event: ActionEvent) => {
      if (event.type !== "SaveOpenRouterKey") return;
      const form = (event.formState ?? {}) as Record<string, unknown>;
      const key = typeof form.openrouterKey === "string" ? form.openrouterKey : "";
      void submit(key);
    },
    [submit],
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.content}
          aria-busy={saving}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.target as HTMLElement).querySelector<HTMLInputElement>('input[name="openrouterKey"]')?.focus();
          }}
        >
          <Dialog.Title className={styles.visuallyHidden}>{t.title}</Dialog.Title>
          <PanelScopeProvider scope={{ facts: [], headingLevel: "two" }}>
            <Renderer key={locale} response={program} library={keyPanelLibrary} isStreaming={false} onAction={handleAction} />
          </PanelScopeProvider>
          {error ? (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          ) : null}
          <div className={styles.footer}>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t.keepPreset}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

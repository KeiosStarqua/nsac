// EN | VI locale chip — same chrome pill as DeviceSwitcher (segmented, letterspaced caps, blur
// backdrop, icon + text, `aria-pressed` on the active segment). The locale lives in the URL (`?lang=`,
// resolved by the root route's `beforeLoad`), so the segments are plain `<Link>`s that preserve every
// other search param. The parent decides viewport hiding (`DEVICE_SWITCHER` hides ≤480px).
// Styles: Tailwind utilities in `hud-classes.ts`.
import { Globe } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { LOCALES, useCopy, useLocale, type Locale } from "../../../shared/i18n";
import { DEVICE_OPTION, DEVICE_SWITCHER } from "../hud-classes";

const OPTIONS: ReadonlyArray<{ id: Locale; label: string }> = LOCALES.map((id) => ({
  id,
  label: id.toUpperCase(),
}));

export function LanguageSwitcher() {
  const copy = useCopy();
  const locale = useLocale();
  return (
    <div className={DEVICE_SWITCHER} role="group" aria-label={copy.hud.langSwitcher}>
      {OPTIONS.map(({ id, label }) => (
        <Link
          key={id}
          to="/"
          search={(prev) => ({ ...prev, lang: id })}
          className={DEVICE_OPTION}
          aria-pressed={locale === id}
        >
          <Globe aria-hidden="true" strokeWidth={1.7} />
          <span>{label}</span>
        </Link>
      ))}
    </div>
  );
}

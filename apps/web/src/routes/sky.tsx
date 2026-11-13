import { createFileRoute } from "@tanstack/react-router";
import { SkyLivingExperience } from "~/features/sky-living";
import { useLocale } from "~/shared/i18n";

export const Route = createFileRoute("/sky")({
  // `data-only`: the whole experience is interactive (canvas Core, state machine, device switcher);
  // nothing useful is server-rendered beyond the shell, and the page must work with the network unplugged.
  ssr: "data-only",
  component: SkyPage,
});

function SkyPage() {
  const locale = useLocale();
  return <SkyLivingExperience locale={locale} />;
}

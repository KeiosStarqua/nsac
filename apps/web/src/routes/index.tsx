import { createFileRoute } from "@tanstack/react-router";
import { SkyStation } from "~/features/sky-guide";

export const Route = createFileRoute("/")({
  // The homepage is Sky's console: the interface is composed with OpenUI, the only image is Sky itself.
  // No marketing sections here; the product concept lives on /concept.
  ssr: true,
  component: Home,
});

function Home() {
  return <SkyStation id="console" placement="top" headingLevel="one" variant="console" />;
}

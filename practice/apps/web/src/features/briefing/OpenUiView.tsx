import { Renderer } from "@openuidev/react-lang";
import { healthLibrary } from "@practice/ui-lib";
import { useScenario } from "~/features/scenario";

/** Small models like to wrap code in ``` fences even when told not to. */
export function stripFences(text: string): string {
  return text
    .split("\n")
    .filter((line) => !line.trim().startsWith("```"))
    .join("\n");
}

interface Props {
  /** OpenUI Lang program, possibly still streaming. */
  program: string;
  streaming?: boolean;
}

export function OpenUiView({ program, streaming = false }: Props) {
  const { confirmIntervention } = useScenario();

  return (
    <div className="openui">
      <Renderer
        response={stripFences(program)}
        library={healthLibrary}
        isStreaming={streaming}
        onAction={(event) => {
          // Only our own "intervention" action can change the story, and only after a click.
          if (event.type !== "intervention") return;
          const id = event.params?.id;
          if (typeof id === "string") confirmIntervention(id);
        }}
      />
    </div>
  );
}

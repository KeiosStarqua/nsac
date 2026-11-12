import { defineAction, defineComponent, useStateField, useTriggerAction } from "@openuidev/react-lang";
import { z } from "zod/v4";
import { Button } from "~/components/arc/button/button";
import { skyLibrary } from "./library";
import styles from "./library.module.css";

// The catalog extension only the key panel uses. The model-facing `skyLibrary` stays action-free:
// these components and the one custom action exist for the hand-written key panel, nothing else.

export const saveOpenRouterKey = defineAction({
  name: "SaveOpenRouterKey",
  description: "Saves the OpenRouter key typed into the KeyField. Only a person saves a key, never a model.",
  params: z.object({}),
});

const KeyField = defineComponent({
  name: "KeyField",
  description: "A masked input for an OpenRouter API key.",
  props: z.object({
    name: z.string().describe("Field name, always openrouterKey"),
    label: z.string().describe("Accessible name of the field"),
  }),
  component: ({ props }) => {
    const field = useStateField(props.name);
    const value = typeof field.value === "string" ? field.value : "";
    return (
      <input
        className={styles.keyField}
        type="password"
        name={props.name}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label={props.label}
        placeholder="sk-or-…"
        value={value}
        onChange={(event) => field.setValue(event.target.value)}
      />
    );
  },
});

const SaveKeyButton = defineComponent({
  name: "SaveKeyButton",
  description: "Saves the key typed into the KeyField.",
  props: z.object({
    label: z.string().describe("Button label"),
    save: z.union([saveOpenRouterKey.ref]).describe("Always @SaveOpenRouterKey()"),
  }),
  component: ({ props }) => {
    const triggerAction = useTriggerAction();
    return (
      <Button variant="primary" className={styles.saveKey} onClick={() => void triggerAction(props.label, undefined, props.save)}>
        {props.label}
      </Button>
    );
  },
});

export const keyPanelLibrary = skyLibrary.extend({
  components: {
    add: [
      { component: KeyField, slots: ["Card.children"] },
      { component: SaveKeyButton, slots: ["Card.children"] },
    ],
  },
  actions: { add: [saveOpenRouterKey] },
});

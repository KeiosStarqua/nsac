// The built-in panel the Renderer shows when Sky needs an OpenRouter key and none is saved — shown by
// the key dialog, never produced by a model. A pure builder so tests can check what the app renders.

export interface KeyPanelStrings {
  title: string;
  cardTitle: string;
  body: string;
  fieldLabel: string;
  saveLabel: string;
  note: string;
}

const escapeLiteral = (text: string) => text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");

/** The OpenUI Lang program for the key dialog's panel. Free text stays digit-free, like every Sky panel. */
export function keyPanelProgram(strings: KeyPanelStrings): string {
  return [
    `root = Console("${escapeLiteral(strings.title)}", [card])`,
    `card = Card("${escapeLiteral(strings.cardTitle)}", [say, field, save, note])`,
    `say = Say("${escapeLiteral(strings.body)}")`,
    `field = KeyField("openrouterKey", "${escapeLiteral(strings.fieldLabel)}")`,
    `save = SaveKeyButton("${escapeLiteral(strings.saveLabel)}", @SaveOpenRouterKey())`,
    `note = Alert("info", "${escapeLiteral(strings.note)}")`,
  ].join("\n");
}

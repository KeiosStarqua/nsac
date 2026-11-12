import { createParser } from "@openuidev/react-lang";
import { describe, expect, it } from "vitest";
import { en } from "~/shared/i18n/en";
import { vi } from "~/shared/i18n/vi";
import { keyPanelLibrary } from "../catalog/key-panel";
import { keyPanelProgram } from "./key-panel";

const parser = createParser(keyPanelLibrary.toJSONSchema(), keyPanelLibrary.root);

describe("keyPanelProgram", () => {
  for (const [locale, copy] of Object.entries({ en, vi })) {
    it(`${locale} parses cleanly against the key panel library`, () => {
      const program = keyPanelProgram(copy.sky.keyDialog);
      const parsed = parser.parse(program);
      expect(parsed.root).not.toBeNull();
      expect(parsed.meta.incomplete).toBe(false);
      expect(parsed.meta.unresolved).toEqual([]);
      expect(parsed.meta.errors).toEqual([]);
    });

    it(`${locale} wires the field to the save action`, () => {
      const program = keyPanelProgram(copy.sky.keyDialog);
      expect(program).toContain('KeyField("openrouterKey"');
      expect(program).toContain("@SaveOpenRouterKey()");
    });
  }

  it("escapes quotes and backslashes in copy", () => {
    const program = keyPanelProgram({
      title: 'He said "hi" \\ ok',
      cardTitle: "card",
      body: "body",
      fieldLabel: "label",
      saveLabel: "save",
      note: "note",
    });
    expect(program).toContain('He said \\"hi\\" \\\\ ok');
  });
});

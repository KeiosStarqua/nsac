import { describe, expect, it } from "vitest";
import { collectFacts, extractProgram, hasDigit, stringLiterals } from "./program";

describe("extractProgram", () => {
  it("drops think blocks and Markdown fences", () => {
    expect(extractProgram("<think>plan</think>\n```openui-lang\nroot = A()\n```\nThanks!")).toBe("root = A()");
  });

  it("keeps an unfenced program as is", () => {
    expect(extractProgram("  root = A()\n")).toBe("root = A()");
  });

  it("handles a fence that is still streaming", () => {
    expect(extractProgram("```\nroot = A(")).toBe("root = A(");
  });
});

describe("text checks", () => {
  it("finds string literals, including escaped quotes", () => {
    expect(stringLiterals('a = Say("one \\"two\\"")\nb = Fact("x")')).toEqual(['one \\"two\\"', "x"]);
  });

  it("flags any decimal digit, not only ASCII", () => {
    expect(hasDigit("no numbers here")).toBe(false);
    expect(hasDigit("dose 5")).toBe(true);
    expect(hasDigit("٣")).toBe(true);
  });
});

describe("collectFacts", () => {
  it("walks nested elements", () => {
    const tree = {
      type: "element",
      typeName: "SkyCard",
      props: {
        children: [
          { type: "element", typeName: "Fact", props: { id: "marsGravity" } },
          { type: "element", typeName: "Say", props: { text: "hi" } },
          { type: "element", typeName: "Fact", props: { id: "notAFact" } },
        ],
      },
    };
    expect(collectFacts(tree)).toEqual(["marsGravity"]);
  });
});

import { describe, it, expect } from "vitest";
import { formatListeningClock } from "./components/ListeningBar";

describe("listening bar clock", () => {
  it("formats seconds as m:ss", () => {
    expect(formatListeningClock(0)).toBe("0:00");
    expect(formatListeningClock(4_400)).toBe("0:04");
    expect(formatListeningClock(59_999)).toBe("0:59");
    expect(formatListeningClock(60_000)).toBe("1:00");
    expect(formatListeningClock(9 * 60_000 + 9_000)).toBe("9:09");
    expect(formatListeningClock(10 * 60_000)).toBe("10:00");
  });
  it("caps at 99:59 and never goes negative", () => {
    expect(formatListeningClock(99 * 60_000 + 59_000)).toBe("99:59");
    expect(formatListeningClock(12 * 60 * 60_000)).toBe("99:59");
    expect(formatListeningClock(-5_000)).toBe("0:00");
  });
});

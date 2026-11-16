import { describe, expect, it } from "vitest";
import {
  ADMIN_DEFAULT_ROUTE,
  ADMIN_DEFAULT_TAB,
  ADMIN_TABS,
  TAB_ROUTE,
  adminTabFromPathname,
  adminTabRoute,
} from "./admin-tabs";

describe("ADMIN_TABS", () => {
  it("has the six tabs in display order", () => {
    expect(ADMIN_TABS.map((tab) => tab.id)).toEqual([
      "models",
      "keys",
      "speech",
      "claims",
      "background",
      "ui",
    ]);
  });

  it("routes every tab to its /admin/<id> route", () => {
    for (const tab of ADMIN_TABS) {
      expect(tab.to).toBe(`/admin/${tab.id}`);
      expect(TAB_ROUTE[tab.id]).toBe(tab.to);
    }
  });

  it("defaults to the models tab", () => {
    expect(ADMIN_DEFAULT_TAB).toBe("models");
    expect(ADMIN_DEFAULT_ROUTE).toBe("/admin/models");
  });
});

describe("adminTabFromPathname", () => {
  it("maps each tab route to its id", () => {
    expect(adminTabFromPathname("/admin/models")).toBe("models");
    expect(adminTabFromPathname("/admin/keys")).toBe("keys");
    expect(adminTabFromPathname("/admin/speech")).toBe("speech");
    expect(adminTabFromPathname("/admin/claims")).toBe("claims");
    expect(adminTabFromPathname("/admin/background")).toBe("background");
    expect(adminTabFromPathname("/admin/ui")).toBe("ui");
  });

  it("folds the legacy key routes into keys", () => {
    expect(adminTabFromPathname("/admin/opencode")).toBe("keys");
    expect(adminTabFromPathname("/admin/elevenlabs")).toBe("keys");
    expect(adminTabFromPathname("/admin/opencode/")).toBe("keys");
  });

  it("falls back to the default tab for /admin and unknown paths", () => {
    expect(adminTabFromPathname("/admin")).toBe("models");
    expect(adminTabFromPathname("/admin/models/")).toBe("models");
    expect(adminTabFromPathname("/admin/nope")).toBe("models");
    expect(adminTabFromPathname("/")).toBe("models");
  });
});

describe("adminTabRoute", () => {
  it("resolves known ids and rejects anything else", () => {
    expect(adminTabRoute("keys")).toBe("/admin/keys");
    expect(adminTabRoute(null)).toBeNull();
    expect(adminTabRoute("bogus")).toBeNull();
    expect(adminTabRoute("opencode")).toBeNull();
  });
});

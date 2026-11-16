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
  it("has the seven tabs in display order", () => {
    expect(ADMIN_TABS.map((tab) => tab.id)).toEqual([
      "models",
      "keys",
      "speech",
      "claims",
      "background",
      "ui",
      "core",
    ]);
  });

  it("puts the agent-core switch last, after background", () => {
    const ids = ADMIN_TABS.map((tab) => tab.id);
    expect(ids.at(-1)).toBe("core");
    expect(ids.indexOf("core")).toBeGreaterThan(ids.indexOf("background"));
  });

  it("labels every tab in both locales", async () => {
    const { en } = await import("../../../shared/i18n/en");
    const { vi } = await import("../../../shared/i18n/vi");
    for (const tab of ADMIN_TABS) {
      expect(en.admin[tab.labelKey]).toBeTruthy();
      expect(vi.admin[tab.labelKey]).toBeTruthy();
    }
    expect(en.admin.tabCore).toBe("Agent Core");
    expect(vi.admin.tabCore).toBe("Lõi agent");
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
    expect(adminTabFromPathname("/admin/core")).toBe("core");
  });

  it("deep-links a nested path under a tab", () => {
    expect(adminTabFromPathname("/admin/core/")).toBe("core");
    expect(adminTabFromPathname("/admin/ui/")).toBe("ui");
    expect(adminTabFromPathname("/admin/speech/engine")).toBe("speech");
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
    expect(adminTabRoute("core")).toBe("/admin/core");
    expect(adminTabRoute(null)).toBeNull();
    expect(adminTabRoute("bogus")).toBeNull();
    expect(adminTabRoute("opencode")).toBeNull();
  });
});

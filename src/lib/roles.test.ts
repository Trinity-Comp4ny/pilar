import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canPreviewUltraAdmin, isLegacyAdmin, isUltraAdmin, setUltraAdminPreview } from "./roles";

// Storage em memória: o localStorage do jsdom não existe neste Node.
beforeEach(() => {
  const dados = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => void dados.set(k, v),
    removeItem: (k: string) => void dados.delete(k),
    clear: () => dados.clear(),
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("isUltraAdmin", () => {
  it("papel ultra_admin sempre é ultra admin", () => {
    vi.stubEnv("DEV", false);
    expect(isUltraAdmin("ultra_admin")).toBe(true);
  });

  it("em produção o preview do localStorage não vale", () => {
    vi.stubEnv("DEV", false);
    window.localStorage.setItem("pilar-ultra-admin-preview", "1");
    expect(isUltraAdmin("admin")).toBe(false);
    expect(canPreviewUltraAdmin()).toBe(false);
    setUltraAdminPreview(true);
    expect(isUltraAdmin("admin")).toBe(false);
  });

  it("em dev o preview liga e desliga", () => {
    vi.stubEnv("DEV", true);
    expect(canPreviewUltraAdmin()).toBe(true);
    setUltraAdminPreview(true);
    expect(isUltraAdmin("admin")).toBe(true);
    setUltraAdminPreview(false);
    expect(isUltraAdmin("admin")).toBe(false);
  });

  it("papel ausente não é ultra admin", () => {
    vi.stubEnv("DEV", false);
    expect(isUltraAdmin(null)).toBe(false);
    expect(isUltraAdmin(undefined)).toBe(false);
  });
});

describe("isLegacyAdmin", () => {
  it("só admin", () => {
    expect(isLegacyAdmin("admin")).toBe(true);
    expect(isLegacyAdmin("ultra_admin")).toBe(false);
    expect(isLegacyAdmin(null)).toBe(false);
  });
});

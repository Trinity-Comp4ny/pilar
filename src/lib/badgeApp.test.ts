import { afterEach, describe, expect, it, vi } from "vitest";
import { definirBadgeApp } from "./badgeApp";

describe("definirBadgeApp", () => {
  afterEach(() => {
    Object.defineProperty(navigator, "setAppBadge", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clearAppBadge", { value: undefined, configurable: true });
  });

  it("define o número e limpa com zero", () => {
    const set = vi.fn().mockResolvedValue(undefined);
    const clear = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "setAppBadge", { value: set, configurable: true });
    Object.defineProperty(navigator, "clearAppBadge", { value: clear, configurable: true });
    definirBadgeApp(3.7);
    expect(set).toHaveBeenCalledWith(3);
    definirBadgeApp(0);
    definirBadgeApp(-2);
    expect(clear).toHaveBeenCalledTimes(2);
  });

  it("sem suporte não faz nada nem quebra", () => {
    expect(() => definirBadgeApp(5)).not.toThrow();
  });

  it("promessa recusada é ignorada", async () => {
    Object.defineProperty(navigator, "setAppBadge", {
      value: vi.fn().mockRejectedValue(new Error("x")),
      configurable: true,
    });
    expect(() => definirBadgeApp(1)).not.toThrow();
    await Promise.resolve();
  });
});

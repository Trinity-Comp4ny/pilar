import { afterEach, describe, expect, it, vi } from "vitest";
import { isTypingTarget, teclaModificadora } from "./teclado";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("teclado", () => {
  it("isTypingTarget reconhece campos e ignora o resto", () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(document.createElement("input"))).toBe(true);
    expect(isTypingTarget(document.createElement("textarea"))).toBe(true);
    expect(isTypingTarget(document.createElement("select"))).toBe(true);
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
  });

  it("teclaModificadora: ⌘ no Mac/iOS, Ctrl nos demais", () => {
    const platform = vi.spyOn(navigator, "platform", "get");
    platform.mockReturnValue("MacIntel");
    expect(teclaModificadora()).toBe("⌘");
    platform.mockReturnValue("iPhone");
    expect(teclaModificadora()).toBe("⌘");
    platform.mockReturnValue("Linux x86_64");
    expect(teclaModificadora()).toBe("Ctrl");
  });
});

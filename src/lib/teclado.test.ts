import { afterEach, describe, expect, it, vi } from "vitest";
import { isShortcutEventBlocked, isSingleKeyShortcutBlocked, isTypingTarget, teclaModificadora } from "./teclado";

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

  it("reconhece campos compostos, inclusive filhos de combobox", () => {
    const editor = document.createElement("div");
    editor.setAttribute("role", "combobox");
    const filho = document.createElement("span");
    editor.appendChild(filho);
    expect(isTypingTarget(filho)).toBe(true);
    editor.setAttribute("role", "button");
    expect(isTypingTarget(filho)).toBe(false);
  });

  it("respeita composição, repetição e eventos já tratados", () => {
    expect(isShortcutEventBlocked(new KeyboardEvent("keydown", { isComposing: true }))).toBe(true);
    expect(isShortcutEventBlocked(new KeyboardEvent("keydown", { repeat: true }))).toBe(true);
    const tratado = new KeyboardEvent("keydown", { cancelable: true });
    tratado.preventDefault();
    expect(isShortcutEventBlocked(tratado)).toBe(true);
    expect(isShortcutEventBlocked(new KeyboardEvent("keydown"))).toBe(false);
  });

  it("atalhos simples respeitam o contexto de diálogo e o foco", () => {
    const dialogo = document.createElement("div");
    dialogo.setAttribute("role", "alertdialog");
    const botao = document.createElement("button");
    dialogo.appendChild(botao);
    document.body.appendChild(dialogo);
    try {
      botao.focus();
      expect(isSingleKeyShortcutBlocked(new KeyboardEvent("keydown", { key: "/" }))).toBe(true);
      expect(isSingleKeyShortcutBlocked(new KeyboardEvent("keydown", { key: "?", shiftKey: true }))).toBe(true);
    } finally {
      dialogo.remove();
    }
    expect(isSingleKeyShortcutBlocked(new KeyboardEvent("keydown", { key: "?", shiftKey: true }))).toBe(false);
    expect(isSingleKeyShortcutBlocked(new KeyboardEvent("keydown", { key: "/", altKey: true }))).toBe(true);
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

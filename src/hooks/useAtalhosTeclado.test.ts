import { describe, expect, it } from "vitest";
import { act, fireEvent, renderHook } from "@testing-library/react";
import { abrirAtalhosTeclado, useAtalhosTeclado } from "./useAtalhosTeclado";

function apertarInterrogacao(init: KeyboardEventInit = {}) {
  act(() => {
    fireEvent.keyDown(window, { key: "?", shiftKey: true, ...init });
  });
}

describe("useAtalhosTeclado", () => {
  it("abre com ? fora de campo de texto", () => {
    const { result } = renderHook(() => useAtalhosTeclado());
    expect(result.current.open).toBe(false);
    apertarInterrogacao();
    expect(result.current.open).toBe(true);
  });

  it("ignora ? com Ctrl/⌘/Alt", () => {
    const { result } = renderHook(() => useAtalhosTeclado());
    apertarInterrogacao({ ctrlKey: true });
    apertarInterrogacao({ metaKey: true });
    apertarInterrogacao({ altKey: true });
    expect(result.current.open).toBe(false);
  });

  it("ignora ? enquanto digita num textarea", () => {
    const { result } = renderHook(() => useAtalhosTeclado());
    const campo = document.createElement("textarea");
    document.body.appendChild(campo);
    campo.focus();
    apertarInterrogacao();
    expect(result.current.open).toBe(false);
    campo.remove();
  });

  it("ignora ? num contenteditable", () => {
    const { result } = renderHook(() => useAtalhosTeclado());
    const editor = document.createElement("div");
    editor.tabIndex = 0;
    // jsdom não calcula isContentEditable.
    Object.defineProperty(editor, "isContentEditable", { value: true });
    document.body.appendChild(editor);
    editor.focus();
    apertarInterrogacao();
    expect(result.current.open).toBe(false);
    editor.remove();
  });

  it("abre pelo evento global (item da paleta ⌘K)", () => {
    const { result } = renderHook(() => useAtalhosTeclado());
    act(() => abrirAtalhosTeclado());
    expect(result.current.open).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCommandPalette } from "./useCommandPalette";

const tecla = (init: KeyboardEventInit) => {
  const e = new KeyboardEvent("keydown", { cancelable: true, ...init });
  act(() => {
    window.dispatchEvent(e);
  });
  return e;
};

describe("useCommandPalette", () => {
  it("Cmd+K e Ctrl+K alternam e bloqueiam o atalho do navegador", () => {
    const { result } = renderHook(() => useCommandPalette());
    expect(result.current.open).toBe(false);

    const e = tecla({ key: "k", metaKey: true });
    expect(result.current.open).toBe(true);
    expect(e.defaultPrevented).toBe(true);

    tecla({ key: "K", ctrlKey: true });
    expect(result.current.open).toBe(false);
  });

  it("K sem modificador ou outra tecla não abre", () => {
    const { result } = renderHook(() => useCommandPalette());
    const e = tecla({ key: "k" });
    tecla({ key: "j", ctrlKey: true });
    expect(result.current.open).toBe(false);
    expect(e.defaultPrevented).toBe(false);
  });

  it("toggle, close e setOpen", () => {
    const { result } = renderHook(() => useCommandPalette());
    act(() => result.current.toggle());
    expect(result.current.open).toBe(true);
    act(() => result.current.close());
    expect(result.current.open).toBe(false);
    act(() => result.current.setOpen(true));
    expect(result.current.open).toBe(true);
  });

  it("remove o listener ao desmontar", () => {
    const { result, unmount } = renderHook(() => useCommandPalette());
    unmount();
    tecla({ key: "k", metaKey: true });
    expect(result.current.open).toBe(false);
  });
});

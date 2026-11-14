import { afterEach, describe, expect, it, vi } from "vitest";
import { foiAcaoRecente, haptico, hapticoDeMutation, registrarToque } from "./haptico";

describe("haptico", () => {
  afterEach(() => vi.restoreAllMocks());

  it("vibra quando há suporte", () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    haptico("leve");
    expect(vibrate).toHaveBeenCalledWith(10);
  });

  it("janela de ação recente", () => {
    registrarToque(1000);
    expect(foiAcaoRecente(3000)).toBe(true);
    expect(foiAcaoRecente(6000)).toBe(false);
  });

  it("mutation sem toque recente ou com meta silenciosa não vibra", () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    registrarToque(Date.now());
    hapticoDeMutation("sucesso", { haptico: false });
    expect(vibrate).not.toHaveBeenCalled();
    hapticoDeMutation("sucesso");
    expect(vibrate).toHaveBeenCalled();
  });
});

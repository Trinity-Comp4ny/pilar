import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initStaleChunkReload, tentarReloadPorChunkVelho } from "./staleChunkReload";

const reload = vi.fn();
const locationOriginal = window.location;

beforeEach(() => {
  reload.mockClear();
  sessionStorage.clear();
  Object.defineProperty(window, "location", { value: { ...locationOriginal, reload }, configurable: true });
});

afterEach(() => {
  Object.defineProperty(window, "location", { value: locationOriginal, configurable: true });
  vi.restoreAllMocks();
});

describe("staleChunkReload › storage e listeners", () => {
  it("storage bloqueado não arrisca reload", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(tentarReloadPorChunkVelho()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("vite:preloadError e unhandledrejection de chunk velho recarregam uma vez", () => {
    initStaleChunkReload();

    const preload = new Event("vite:preloadError", { cancelable: true });
    window.dispatchEvent(preload);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(preload.defaultPrevented).toBe(true);

    // logo em seguida: guarda anti-loop segura o segundo reload
    const preload2 = new Event("vite:preloadError", { cancelable: true });
    window.dispatchEvent(preload2);
    expect(preload2.defaultPrevented).toBe(false);

    sessionStorage.clear();
    const rejeicao = Object.assign(new Event("unhandledrejection", { cancelable: true }), {
      reason: new TypeError("Failed to fetch dynamically imported module: /assets/x.js"),
    });
    window.dispatchEvent(rejeicao);
    expect(rejeicao.defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);

    const outra = Object.assign(new Event("unhandledrejection", { cancelable: true }), {
      reason: new Error("rede caiu"),
    });
    window.dispatchEvent(outra);
    expect(outra.defaultPrevented).toBe(false);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});

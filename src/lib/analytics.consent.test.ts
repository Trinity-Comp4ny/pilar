import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

const { initMock, captureMock, optOutMock, resetMock } = vi.hoisted(() => ({
  initMock: vi.fn(),
  captureMock: vi.fn(),
  optOutMock: vi.fn(),
  resetMock: vi.fn(),
}));

vi.mock("posthog-js", () => ({
  default: {
    init: initMock,
    capture: captureMock,
    identify: vi.fn(),
    opt_out_capturing: optOutMock,
    reset: resetMock,
    isFeatureEnabled: vi.fn(() => true),
  },
}));

// Sem o import real de posthog-js (mockado acima), este ambiente jsdom não expõe
// um `localStorage` funcional. O próprio import de posthog-js normalmente
// resolve isso em analytics.test.ts. Polyfill mínimo escopado a este arquivo.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}
globalThis.localStorage = new MemoryStorage() as unknown as Storage;

let analytics: typeof import("./analytics").analytics;
let applyCookieConsent: typeof import("./analytics").applyCookieConsent;
let getCookieConsent: typeof import("./cookieConsent").getCookieConsent;

// vi.stubEnv precisa rodar ANTES do módulo ler VITE_POSTHOG_KEY; import dinâmico
// dentro de beforeAll garante essa ordem (import estático seria avaliado cedo demais).
beforeAll(async () => {
  vi.stubEnv("VITE_POSTHOG_KEY", "test-key");
  ({ analytics, applyCookieConsent } = await import("./analytics"));
  ({ getCookieConsent } = await import("./cookieConsent"));
});

describe("analytics: gate de consentimento (ADR 0022)", () => {
  beforeEach(() => {
    localStorage.clear();
    initMock.mockClear();
    captureMock.mockClear();
    optOutMock.mockClear();
    resetMock.mockClear();
  });

  it("não toca o PostHog sem consentimento salvo", () => {
    analytics.track("evento_qualquer");
    analytics.init();
    expect(initMock).not.toHaveBeenCalled();
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("inicializa e envia eventos depois de aceitar", () => {
    applyCookieConsent(true);
    expect(initMock).toHaveBeenCalledTimes(1);

    analytics.track("evento_qualquer");
    expect(captureMock).toHaveBeenCalledWith("evento_qualquer", undefined);
  });

  it("revoga consentimento: opt_out + reset, sem reinicializar sozinho", () => {
    applyCookieConsent(true);
    applyCookieConsent(false);

    expect(optOutMock).toHaveBeenCalledTimes(1);
    expect(resetMock).toHaveBeenCalledTimes(1);
    expect(getCookieConsent()?.analytics).toBe(false);

    analytics.track("evento_depois_de_recusar");
    expect(captureMock).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { limparCookies } from "./test/ambiente";

/**
 * Analytics só roda com consentimento (ADR 0022 + ADR 0032). A key do PostHog
 * é lida no import do módulo, então cada teste importa `analytics.ts` de novo
 * depois de ajustar o ambiente.
 */

const posthog = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  opt_out_capturing: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: posthog }));

async function carregar(key: string | undefined, host?: string) {
  vi.resetModules();
  vi.stubEnv("VITE_POSTHOG_KEY", key as string);
  if (host) vi.stubEnv("VITE_POSTHOG_HOST", host);
  const analytics = await import("./analytics");
  const consent = await import("./cookieConsent");
  return { ...analytics, ...consent };
}

describe("analytics da landing", () => {
  beforeEach(() => {
    limparCookies();
    localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    limparCookies();
  });

  it("sem decisão de cookies, não inicia nem captura nada", async () => {
    const a = await carregar("phc_teste");

    a.initAnalytics();
    a.trackCta("agende_demo", "hero");

    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("consentimento recusado: nenhuma chamada ao PostHog, nem no clique de CTA", async () => {
    const a = await carregar("phc_teste");

    a.applyCookieConsent(false);
    a.initAnalytics();
    a.trackCta("agende_demo", "hero");

    expect(a.getCookieConsent()?.analytics).toBe(false);
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
    expect(posthog.opt_out_capturing).not.toHaveBeenCalled();
  });

  it("consentimento aceito: inicia uma vez, sem autocapture nem gravação, e captura o CTA", async () => {
    const a = await carregar("phc_teste");

    a.applyCookieConsent(true);
    a.initAnalytics();
    a.trackCta("agende_demo", "planos_pro");

    expect(posthog.init).toHaveBeenCalledTimes(1);
    expect(posthog.init).toHaveBeenCalledWith(
      "phc_teste",
      expect.objectContaining({
        api_host: "https://us.i.posthog.com",
        autocapture: false,
        disable_session_recording: true,
        person_profiles: "identified_only",
      })
    );
    expect(posthog.capture).toHaveBeenCalledWith("landing_cta_clicked", { cta: "agende_demo", location: "planos_pro" });
  });

  it("respeita o host configurado", async () => {
    const a = await carregar("phc_teste", "https://eu.i.posthog.com");
    a.applyCookieConsent(true);
    expect(posthog.init).toHaveBeenCalledWith(
      "phc_teste",
      expect.objectContaining({ api_host: "https://eu.i.posthog.com" })
    );
  });

  it("consentimento salvo antes (cookie) inicia no carregamento da página", async () => {
    const a = await carregar("phc_teste");
    a.saveCookieConsent(true);

    a.initAnalytics();
    expect(posthog.init).toHaveBeenCalledTimes(1);
  });

  it("revogar depois de aceitar desliga a captura e limpa a identidade", async () => {
    const a = await carregar("phc_teste");

    a.applyCookieConsent(true);
    a.applyCookieConsent(false);
    a.trackCta("agende_demo", "hero");

    expect(posthog.opt_out_capturing).toHaveBeenCalledTimes(1);
    expect(posthog.reset).toHaveBeenCalledTimes(1);
    expect(posthog.capture).not.toHaveBeenCalled();

    // Aceitar de novo volta a iniciar.
    a.applyCookieConsent(true);
    expect(posthog.init).toHaveBeenCalledTimes(2);
  });

  it("sem VITE_POSTHOG_KEY roda em no-op mesmo com consentimento, e ainda grava a escolha", async () => {
    const a = await carregar("");

    a.applyCookieConsent(true);
    a.initAnalytics();
    a.trackCta("agende_demo", "hero");
    a.applyCookieConsent(false);

    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
    expect(posthog.opt_out_capturing).not.toHaveBeenCalled();
    expect(a.getCookieConsent()?.analytics).toBe(false);
  });
});

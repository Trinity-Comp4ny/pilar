import { describe, it, expect, beforeEach } from "vitest";
import { applyCookieConsent, initAnalytics } from "./analytics";

// O Google Tag Manager só pode entrar na página depois do aceite de análise: antes ele
// carregava pelo index.html em toda visita, sem base legal (parecer LGPD, 2026-11-10).

type DataLayerWindow = Window & { dataLayer?: unknown[] };

const scriptGtm = () => document.getElementById("pilar-gtm") as HTMLScriptElement | null;

/** Últimos comandos `consent` empurrados no dataLayer, como objetos legíveis. */
function comandosDeConsentimento(): Array<{ acao: unknown; estado: Record<string, string> }> {
  const dl = (window as DataLayerWindow).dataLayer ?? [];
  return dl
    .map((item) => Array.from(item as ArrayLike<unknown>))
    .filter((args) => args[0] === "consent")
    .map((args) => ({ acao: args[1], estado: args[2] as Record<string, string> }));
}

function limparConsentimento() {
  document.cookie = "pilar_cookie_consent=; path=/; max-age=0";
}

describe("Google Tag Manager: portão de consentimento", () => {
  beforeEach(() => {
    limparConsentimento();
    scriptGtm()?.remove();
    delete (window as DataLayerWindow).dataLayer;
  });

  it("sem decisão, não carrega o GTM", () => {
    initAnalytics();
    expect(scriptGtm()).toBeNull();
    expect((window as DataLayerWindow).dataLayer).toBeUndefined();
  });

  it("recusa não carrega o GTM", () => {
    applyCookieConsent(false);
    expect(scriptGtm()).toBeNull();
  });

  it("aceite carrega o GTM com análise liberada e publicidade negada", () => {
    applyCookieConsent(true);
    expect(scriptGtm()?.src).toContain("googletagmanager.com/gtm.js?id=GTM-");
    const [padrao] = comandosDeConsentimento();
    expect(padrao.acao).toBe("default");
    expect(padrao.estado).toMatchObject({
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  });

  it("revogar depois do aceite nega a análise no Consent Mode", () => {
    applyCookieConsent(true);
    applyCookieConsent(false);
    const ultimo = comandosDeConsentimento().at(-1);
    expect(ultimo?.acao).toBe("update");
    expect(ultimo?.estado.analytics_storage).toBe("denied");
  });
});

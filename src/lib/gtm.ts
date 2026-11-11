/**
 * Google Tag Manager, só com consentimento de análise.
 *
 * Antes ele carregava pelo index.html em toda página do app, antes de qualquer
 * decisão do usuário: o Google recebia IP, navegador e rota sem base legal, ao
 * contrário do que a Política de Privacidade promete. Agora entra pelo mesmo
 * portão do PostHog (ADR 0022): `analytics.ts` chama `loadGtm()` só depois do
 * aceite e `revokeGtm()` quando a pessoa recusa ou revoga.
 *
 * Consent Mode v2: análise liberada (é o que a pessoa aceitou), publicidade
 * sempre negada, porque o banner não pede consentimento para publicidade e a
 * Política de Cookies diz que não usamos cookie de marketing.
 */

const GTM_ID = "GTM-MFX2M978";
const SCRIPT_ID = "pilar-gtm";

type DataLayerWindow = Window & { dataLayer?: unknown[] };

function gtag(..._args: unknown[]): void {
  const w = window as DataLayerWindow;
  w.dataLayer = w.dataLayer ?? [];
  // O gtag espera o objeto `arguments`, não um array: é assim que o GTM
  // distingue comando de consentimento de um evento comum.
  // eslint-disable-next-line prefer-rest-params
  w.dataLayer.push(arguments);
}

const NEGADO_PUBLICIDADE = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
} as const;

export function loadGtm(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(SCRIPT_ID)) {
    gtag("consent", "update", { ...NEGADO_PUBLICIDADE, analytics_storage: "granted" });
    return;
  }

  gtag("consent", "default", { ...NEGADO_PUBLICIDADE, analytics_storage: "granted" });
  const w = window as DataLayerWindow;
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.appendChild(script);
}

/** Revogação: o script já carregado não sai da página, mas para de gravar e enviar análise. */
export function revokeGtm(): void {
  if (typeof document === "undefined") return;
  if (!document.getElementById(SCRIPT_ID)) return;
  gtag("consent", "update", { ...NEGADO_PUBLICIDADE, analytics_storage: "denied" });
}

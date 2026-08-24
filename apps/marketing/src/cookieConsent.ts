/**
 * Consentimento de cookies da LP (ADR 0022 + ADR 0032).
 *
 * Espelha src/lib/cookieConsent.ts do app. Os dois domínios não compartilham
 * código (ADR 0021), mas compartilham o dado: o cookie é gravado em
 * `.pilarsoft.com.br`, então a resposta dada aqui já vale em
 * app.pilarsoft.com.br e o usuário não é perguntado duas vezes.
 *
 * Aqui, diferente do app, o banner continua existindo: visitante anônimo só
 * pode ser perguntado na landing.
 */

const COOKIE_NAME = "pilar_cookie_consent";
/** Onde a decisão morava antes do ADR 0032. Migrado e apagado na primeira leitura. */
const LEGACY_STORAGE_KEY = "pilar_cookie_consent";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const CONSENT_CHANGED_EVENT = "pilar:cookie-consent-changed";
export const CONSENT_REVIEW_REQUESTED_EVENT = "pilar:cookie-consent-review-requested";

export interface CookieConsent {
  analytics: boolean;
  decidedAt: string;
}

function parseConsent(raw: string): CookieConsent | null {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.analytics !== "boolean") return null;
    return { analytics: parsed.analytics, decidedAt: String(parsed.decidedAt ?? "") };
  } catch {
    return null;
  }
}

function readConsentCookie(): CookieConsent | null {
  const prefix = `${COOKIE_NAME}=`;
  const entry = document.cookie.split("; ").find((c) => c.startsWith(prefix));
  if (!entry) return null;
  try {
    return parseConsent(decodeURIComponent(entry.slice(prefix.length)));
  } catch {
    return null;
  }
}

function writeConsentCookie(consent: CookieConsent): void {
  const { hostname, protocol } = window.location;
  const domainAttr = hostname.endsWith("pilarsoft.com.br") ? "; domain=.pilarsoft.com.br" : "";
  const secureAttr = protocol === "https:" ? "; secure" : "";
  const value = encodeURIComponent(JSON.stringify(consent));
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax${domainAttr}${secureAttr}`;
}

function migrateLegacyConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    const consent = parseConsent(raw);
    if (!consent) return null;
    writeConsentCookie(consent);
    return consent;
  } catch {
    return null;
  }
}

export function getCookieConsent(): CookieConsent | null {
  return readConsentCookie() ?? migrateLegacyConsent();
}

export function hasCookieDecision(): boolean {
  return getCookieConsent() !== null;
}

export function saveCookieConsent(analytics: boolean): void {
  const consent: CookieConsent = { analytics, decidedAt: new Date().toISOString() };
  writeConsentCookie(consent);
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: consent }));
}

/** Reabre o banner sem apagar a escolha anterior. Usado pelo link "Preferências de cookies" no rodapé. */
export function requestCookieConsentReview(): void {
  window.dispatchEvent(new Event(CONSENT_REVIEW_REQUESTED_EVENT));
}

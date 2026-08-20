/**
 * Consentimento de cookies (ADR 0022 + ADR 0032).
 *
 * A decisão vive num cookie de primeira parte gravado no domínio pai
 * (`.pilarsoft.com.br`), então landing e app leem a mesma resposta: quem aceita
 * em pilarsoft.com.br não é perguntado de novo em app.pilarsoft.com.br. Mesmo
 * mecanismo do `pilar_logged_hint` em AuthContext.
 *
 * Para usuário autenticado, este cookie é só cache: a fonte de verdade é a
 * tabela `cookie_consents`, reconciliada no login por `cookieConsentSync.ts`.
 *
 * Categoria única exposta: analytics (PostHog). Sessão do Supabase é essencial
 * e não aparece como toggle.
 *
 * Espelhado em apps/marketing/src/cookieConsent.ts (ADR 0021: os dois apps são
 * builds separados; o que compartilham é o dado, não o código).
 */

const COOKIE_NAME = "pilar_cookie_consent";
/** Onde a decisão morava antes do ADR 0032. Migrado e apagado na primeira leitura. */
const LEGACY_STORAGE_KEY = "pilar_cookie_consent";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const CONSENT_CHANGED_EVENT = "pilar:cookie-consent-changed";

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
  // Sem domain em localhost/preview: cookie vale para a origem corrente.
  const domainAttr = hostname.endsWith("pilarsoft.com.br") ? "; domain=.pilarsoft.com.br" : "";
  const secureAttr = protocol === "https:" ? "; secure" : "";
  const value = encodeURIComponent(JSON.stringify(consent));
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax${domainAttr}${secureAttr}`;
}

/** Decisão antiga em localStorage vira cookie uma vez; ninguém é perguntado de novo por causa do deploy. */
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

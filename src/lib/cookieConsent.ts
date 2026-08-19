/**
 * Consentimento de cookies: decisão local ao navegador (ADR 0022).
 * Categoria única exposta: analytics (PostHog). Sessão do Supabase é essencial
 * e não aparece como toggle.
 */

const STORAGE_KEY = "pilar_cookie_consent";
export const CONSENT_CHANGED_EVENT = "pilar:cookie-consent-changed";
export const CONSENT_REVIEW_REQUESTED_EVENT = "pilar:cookie-consent-review-requested";

export interface CookieConsent {
  analytics: boolean;
  decidedAt: string;
}

export function getCookieConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.analytics !== "boolean") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasCookieDecision(): boolean {
  return getCookieConsent() !== null;
}

export function saveCookieConsent(analytics: boolean): void {
  const consent: CookieConsent = { analytics, decidedAt: new Date().toISOString() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  } catch {
    /* localStorage indisponível (modo privado antigo), segue sem persistir */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: consent }));
}

/** Reabre o banner sem apagar a escolha anterior. Usado pelo link "alterar preferências". */
export function requestCookieConsentReview(): void {
  window.dispatchEvent(new Event(CONSENT_REVIEW_REQUESTED_EVENT));
}

/**
 * Consentimento de cookies: decisão local a este domínio (ADR 0022).
 * Espelha src/lib/cookieConsent.ts do app; os dois domínios não compartilham
 * storage, cada um pede e guarda sua própria decisão.
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
    /* localStorage indisponível, segue sem persistir */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: consent }));
}

export function requestCookieConsentReview(): void {
  window.dispatchEvent(new Event(CONSENT_REVIEW_REQUESTED_EVENT));
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONSENT_CHANGED_EVENT,
  CONSENT_REVIEW_REQUESTED_EVENT,
  getCookieConsent,
  hasCookieDecision,
  requestCookieConsentReview,
  saveCookieConsent,
} from "./cookieConsent";
import { limparCookies } from "./test/ambiente";

const COOKIE = "pilar_cookie_consent";

describe("cookieConsent", () => {
  beforeEach(() => {
    limparCookies();
    localStorage.clear();
  });
  afterEach(() => {
    limparCookies();
    localStorage.clear();
  });

  it("sem decisão salva, não há consentimento", () => {
    expect(getCookieConsent()).toBeNull();
    expect(hasCookieDecision()).toBe(false);
  });

  it.each([true, false])("salva a escolha (analytics=%s) no cookie e avisa quem escuta", (aceitou) => {
    const ouvinte = vi.fn();
    window.addEventListener(CONSENT_CHANGED_EVENT, ouvinte);

    saveCookieConsent(aceitou);

    expect(document.cookie).toContain(`${COOKIE}=`);
    expect(getCookieConsent()?.analytics).toBe(aceitou);
    expect(hasCookieDecision()).toBe(true);
    expect(ouvinte).toHaveBeenCalledTimes(1);
    expect((ouvinte.mock.calls[0][0] as CustomEvent).detail.analytics).toBe(aceitou);

    window.removeEventListener(CONSENT_CHANGED_EVENT, ouvinte);
  });

  it("grava a data da decisão em ISO", () => {
    saveCookieConsent(true);
    expect(new Date(getCookieConsent()!.decidedAt).toISOString()).toBe(getCookieConsent()!.decidedAt);
  });

  it("a última escolha vale (aceitar e depois recusar)", () => {
    saveCookieConsent(true);
    saveCookieConsent(false);
    expect(getCookieConsent()?.analytics).toBe(false);
  });

  it("cookie corrompido ou sem o campo analytics conta como sem decisão", () => {
    document.cookie = `${COOKIE}=nao-e-json; path=/`;
    expect(getCookieConsent()).toBeNull();

    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify({ analytics: "sim" }))}; path=/`;
    expect(getCookieConsent()).toBeNull();

    document.cookie = `${COOKIE}=%E0%A4%A; path=/`;
    expect(getCookieConsent()).toBeNull();
  });

  it("migra a decisão antiga do localStorage para o cookie e apaga a chave (ADR 0032)", () => {
    localStorage.setItem(COOKIE, JSON.stringify({ analytics: true, decidedAt: "2026-01-01T00:00:00.000Z" }));

    expect(getCookieConsent()).toEqual({ analytics: true, decidedAt: "2026-01-01T00:00:00.000Z" });
    expect(localStorage.getItem(COOKIE)).toBeNull();
    expect(document.cookie).toContain(`${COOKIE}=`);
  });

  it("decisão antiga inválida no localStorage é descartada sem virar consentimento", () => {
    localStorage.setItem(COOKIE, "{quebrado");
    expect(getCookieConsent()).toBeNull();
    expect(localStorage.getItem(COOKIE)).toBeNull();
  });

  it("pedir revisão dispara o evento que reabre o banner, sem apagar a escolha", () => {
    saveCookieConsent(true);
    const ouvinte = vi.fn();
    window.addEventListener(CONSENT_REVIEW_REQUESTED_EVENT, ouvinte);

    requestCookieConsentReview();

    expect(ouvinte).toHaveBeenCalledTimes(1);
    expect(getCookieConsent()?.analytics).toBe(true);
    window.removeEventListener(CONSENT_REVIEW_REQUESTED_EVENT, ouvinte);
  });
});

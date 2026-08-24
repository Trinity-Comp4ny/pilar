/**
 * Analytics da LP: mesmo projeto PostHog do app (VITE_POSTHOG_KEY), pra medir
 * o funil completo visita → clique em CTA → cadastro num lugar só. Sem key
 * configurada, roda em no-op (a LP não trava nem loga erro).
 *
 * Diferente de src/lib/analytics.ts (app): sem identify/scrub de PII, a LP não
 * tem formulário nem usuário autenticado, só pageview e clique em CTA.
 *
 * Consentimento (ADR 0022 + ADR 0032): nada aqui chama posthog.init() sem
 * consentimento salvo via saveCookieConsent(true). applyCookieConsent() é
 * chamado pelo banner e pelo link "Preferências de cookies" no rodapé. A
 * decisão é gravada em cookie de .pilarsoft.com.br, então já vale no app.
 */
import posthog from "posthog-js";
import { getCookieConsent, saveCookieConsent } from "./cookieConsent";

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://us.i.posthog.com";

let posthogInitialized = false;

function hasAnalyticsConsent(): boolean {
  return getCookieConsent()?.analytics === true;
}

function ensurePosthogInit() {
  if (posthogInitialized || !KEY) return;
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,
    person_profiles: "identified_only",
    disable_session_recording: true,
  });
  posthogInitialized = true;
}

export function initAnalytics() {
  if (!KEY || !hasAnalyticsConsent()) return;
  ensurePosthogInit();
}

/** Clique em CTA que sai da LP pro app (cadastro, planos, login). No-op sem consentimento. */
export function trackCta(cta: string, location: string) {
  if (!KEY || !hasAnalyticsConsent()) return;
  ensurePosthogInit();
  posthog.capture("landing_cta_clicked", { cta, location });
}

/** Chamado pelo banner de consentimento e pelo link "Preferências de cookies" no rodapé. */
export function applyCookieConsent(analyticsAccepted: boolean) {
  saveCookieConsent(analyticsAccepted);
  if (analyticsAccepted) {
    initAnalytics();
    return;
  }
  if (posthogInitialized) {
    posthog.opt_out_capturing();
    posthog.reset();
    posthogInitialized = false;
  }
}

/**
 * Analytics da LP — mesmo projeto PostHog do app (VITE_POSTHOG_KEY), pra medir
 * o funil completo visita → clique em CTA → cadastro num lugar só. Sem key
 * configurada, roda em no-op (a LP não trava nem loga erro).
 *
 * Diferente de src/lib/analytics.ts (app): sem identify/scrub de PII — a LP não
 * tem formulário nem usuário autenticado, só pageview e clique em CTA.
 */
import posthog from "posthog-js";

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://us.i.posthog.com";

export function initAnalytics() {
  if (!KEY) return;
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,
    person_profiles: "identified_only",
    disable_session_recording: true,
  });
}

/** Clique em CTA que sai da LP pro app (cadastro, planos, login). No-op sem key. */
export function trackCta(cta: string, location: string) {
  if (!KEY) return;
  posthog.capture("landing_cta_clicked", { cta, location });
}

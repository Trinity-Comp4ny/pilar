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
import type { PostHog } from "posthog-js";
import { getCookieConsent, saveCookieConsent } from "./cookieConsent";
import { classificarCanal, lerOrigem, registrarInteresseDemo } from "./lib/origem";

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://us.i.posthog.com";

/**
 * O PostHog só é baixado depois do consentimento (import dinâmico): quem não
 * aceitou cookies, ou ainda não decidiu, não paga o peso dele na primeira visita.
 * É a maior parte do JavaScript da landing que não aparece na tela, e pesa no
 * LCP e no INP medidos pelo Google (Core Web Vitals).
 */
let carregando: Promise<PostHog> | null = null;

function hasAnalyticsConsent(): boolean {
  return getCookieConsent()?.analytics === true;
}

function obterPosthog(): Promise<PostHog> {
  if (!carregando) {
    carregando = import("posthog-js").then(({ default: posthog }) => {
      posthog.init(KEY as string, {
        api_host: HOST,
        capture_pageview: true,
        capture_pageleave: true,
        autocapture: false,
        person_profiles: "identified_only",
        disable_session_recording: true,
      });
      return posthog;
    });
    // Falha de rede no download: libera para tentar de novo no próximo clique.
    carregando.catch(() => {
      carregando = null;
    });
  }
  return carregando;
}

export function initAnalytics() {
  if (!KEY || !hasAnalyticsConsent()) return;
  void obterPosthog().catch(() => undefined);
}

/** Clique em CTA que sai da LP pro app (cadastro, planos, login). No-op sem consentimento. */
export function trackCta(cta: string, location: string) {
  // Origem do pedido de demonstração (SPEC 149): independe do consentimento de
  // cookies porque não identifica ninguém nem guarda nada no navegador.
  if (cta === "agende_demo") registrarInteresseDemo(location);
  if (!KEY || !hasAnalyticsConsent()) return;
  // Canal e página no evento: o painel quebra cliques por origem (Google, ChatGPT,
  // LinkedIn...) e por artigo do blog sem cruzar com outra tabela. Lidos agora,
  // antes do download, para valerem a página do clique.
  const origem = lerOrigem();
  const propriedades = {
    cta,
    location,
    canal: classificarCanal(origem),
    pagina: window.location.pathname,
    ...(origem.utm_campaign ? { utm_campaign: origem.utm_campaign } : {}),
  };
  void obterPosthog()
    .then((posthog) => posthog.capture("landing_cta_clicked", propriedades))
    .catch(() => undefined);
}

/** Chamado pelo banner de consentimento e pelo link "Preferências de cookies" no rodapé. */
export function applyCookieConsent(analyticsAccepted: boolean) {
  saveCookieConsent(analyticsAccepted);
  if (analyticsAccepted) {
    initAnalytics();
    return;
  }
  if (carregando) {
    const anterior = carregando;
    carregando = null;
    void anterior
      .then((posthog) => {
        posthog.opt_out_capturing();
        posthog.reset();
      })
      .catch(() => undefined);
  }
}

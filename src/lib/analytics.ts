import { origemAtual } from "./origem";
import { scrubTelemetry } from "@/lib/scrubTelemetry";
/**
 * Analytics layer: PostHog backed com fallback no-op.
 *
 * Ativação:
 *   1. Definir VITE_POSTHOG_KEY no .env (obrigatório para envio real)
 *   2. Opcional: VITE_POSTHOG_HOST (default: https://us.i.posthog.com)
 *
 * Sem key, roda em no-op (console.debug em dev, silêncio em prod).
 *
 * Consentimento (ADR 0022 + ADR 0032): nada aqui toca o PostHog sem
 * consentimento de analytics salvo via `saveCookieConsent(true)`. Sem decisão,
 * o padrão é não rastrear (fail-closed). O app não tem banner: quem chama
 * `applyCookieConsent()` é o `cookieConsentSync.ts`, seja reconciliando a
 * preferência da conta no login, seja pelo toggle em Configurações →
 * Privacidade.
 *
 * PII scrubbing: todos os traits/properties passam por scrub() antes de sair,
 * mesma blocklist e regex do monitoring.ts.
 *
 * Google Tag Manager (gtm.ts) passa pelo mesmo portão: só carrega com o aceite.
 *
 * Carregamento: o SDK do PostHog (~80 kB gzip) vem por import dinâmico no
 * primeiro uso com consentimento, fora do carregamento inicial. Chamadas feitas
 * antes do download terminar esperam na ordem em que chegaram.
 */

import type { PostHog } from "posthog-js";
import { env } from "./env";
import { getCookieConsent, saveCookieConsent } from "./cookieConsent";
import { loadGtm, revokeGtm } from "./gtm";
import type { EventoProduto } from "./eventosProduto";

type Props = Record<string, unknown>;

export interface AnalyticsTraits {
  empresa_id?: string;
  role?: string;
  [k: string]: unknown;
}

interface Analytics {
  init(): void;
  identify(userId: string, traits?: AnalyticsTraits): void;
  track(event: EventoProduto, properties?: Props): void;
  trackLogin(userId: string, traits: AnalyticsTraits): void;
  reset(): void;
  isFeatureEnabled(key: string): boolean | undefined;
  getAnonId(): string;
}

const DEV = import.meta.env.DEV;
const KEY = env.VITE_POSTHOG_KEY;
const HOST = env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com";

// E-mail e telefone também: o registro de tratamento (docs/ROPA.md, item 11) declara
// que o PostHog recebe evento, rota, empresa_id e role, nunca contato da pessoa.
const SENSITIVE_KEYS =
  /password|senha|token|api_key|secret|authorization|cookie|cpf|cnpj|rg|pix|conta_bancaria|agencia|salario|e_?mail|telefone|phone|celular/i;

const scrub = (value: unknown) => scrubTelemetry(value, SENSITIVE_KEYS, true);

const ANON_KEY = "pilar-analytics-anon-id";

function ensureAnonId(): string {
  try {
    const existing = localStorage.getItem(ANON_KEY);
    if (existing) return existing;
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(ANON_KEY, fresh);
    return fresh;
  } catch {
    return `anon-${Date.now().toString(36)}`;
  }
}

const noopAnalytics: Analytics = {
  init() {
    if (DEV) console.debug("[analytics] no-op mode (no VITE_POSTHOG_KEY)");
  },
  identify(userId, traits) {
    if (DEV) console.debug("[analytics] identify", userId, scrub(traits));
  },
  track(event, properties) {
    if (DEV) console.debug("[analytics] track", event, scrub(properties));
  },
  trackLogin() {},
  reset() {
    if (DEV) console.debug("[analytics] reset");
  },
  isFeatureEnabled() {
    return undefined;
  },
  getAnonId() {
    return ensureAnonId();
  },
};

let posthog: PostHog | null = null;
let posthogLoading: Promise<PostHog | null> | null = null;
let posthogInitialized = false;

/**
 * Medição de uso dentro do app (PostHog) se apoia em legítimo interesse (LGPD Art. 7, IX), não em
 * consentimento: a pessoa aceita os Termos e a Política no cadastro, que informam a medição, e pode
 * se opor em Configurações → Privacidade. Uma decisão explícita (aceite ou objeção, no cookie ou na
 * conta) sempre vence. Sem decisão e fora do app logado, segue fail-closed (landing pede consentimento).
 * O Google Tag Manager continua só com consentimento.
 */
let legitimoInteresse = false;

function hasAnalyticsConsent(): boolean {
  const decisao = getCookieConsent();
  if (decisao) return decisao.analytics;
  return legitimoInteresse;
}

/** Liga a medição por legítimo interesse para quem está logado e nunca decidiu nem se opôs. */
export function applyLegitimateInterest() {
  if (legitimoInteresse) return;
  legitimoInteresse = true;
  analytics.init();
}

function loadPosthog(): Promise<PostHog | null> {
  if (posthog) return Promise.resolve(posthog);
  posthogLoading ??= import("posthog-js")
    .then(({ default: ph }) => {
      posthog = ph;
      return ph;
    })
    .catch(() => {
      // Falha de rede no chunk não pode quebrar o app: tenta de novo no próximo uso.
      posthogLoading = null;
      return null;
    });
  return posthogLoading;
}

function ensurePosthogInit(ph: PostHog) {
  if (posthogInitialized || !KEY) return;
  ph.init(KEY, {
    api_host: HOST,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,
    person_profiles: "identified_only",
    // Replay só liga com o aceite (withPosthog) E com o replay ligado no projeto PostHog.
    // Tudo mascarado: o vídeo mostra layout, cliques e navegação, nunca texto, campo ou
    // imagem (docs/ROPA.md, item 11), mesmo padrão do replay do Sentry (OPCOES_REPLAY).
    disable_session_recording: false,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "*",
      blockSelector: "img, video, canvas, iframe",
    },
    bootstrap: { distinctID: ensureAnonId() },
    sanitize_properties: (props) => scrub(props) as Record<string, unknown>,
  });
  // A escolha da Pilar pode ter mudado desde o último uso deste navegador.
  if (ph.has_opted_out_capturing()) ph.opt_in_capturing({ captureEventName: false });
  posthogInitialized = true;
}

/** Roda `fn` no PostHog iniciado, só com consentimento (checado de novo após o download). */
let posthogGeneration = 0;

function withPosthog(fn: (ph: PostHog) => void) {
  if (!hasAnalyticsConsent()) return;
  const generation = posthogGeneration;
  const run = (ph: PostHog | null) => {
    if (!ph || generation !== posthogGeneration || !hasAnalyticsConsent()) return;
    ensurePosthogInit(ph);
    fn(ph);
  };
  if (posthog) {
    run(posthog);
    return;
  }
  void loadPosthog().then(run);
}

const posthogAnalytics: Analytics = {
  init() {
    withPosthog(() => undefined);
  },
  identify(userId, traits) {
    withPosthog((ph) => {
      ph.identify(userId, scrub(traits) as Record<string, unknown> | undefined);
      // Todo evento seguinte leva o escritório: retenção e adoção por empresa sem o
      // add-on pago de group analytics do PostHog.
      if (traits?.empresa_id) ph.register({ empresa_id: traits.empresa_id });
    });
  },
  track(event, properties) {
    withPosthog((ph) =>
      ph.capture(event, { origin: origemAtual(), ...(scrub(properties) as Record<string, unknown> | undefined) })
    );
  },
  trackLogin(userId, traits) {
    withPosthog((ph) => {
      const chave = "pilar_login_registrado";
      try {
        if (sessionStorage.getItem(chave) === userId) return;
      } catch {
        // A captura continua disponível com armazenamento bloqueado.
      }
      const evento = ph.capture("login_realizado", { role: traits.role, empresa_id: traits.empresa_id });
      if (!evento) return;
      try {
        sessionStorage.setItem(chave, userId);
      } catch {
        // Sem armazenamento não há como deduplicar entre recargas.
      }
    });
  },
  reset() {
    legitimoInteresse = false;
    posthogGeneration++;
    if (posthogInitialized) posthog?.reset();
  },
  isFeatureEnabled(key) {
    if (!hasAnalyticsConsent() || !posthogInitialized || !posthog) return undefined;
    return posthog.isFeatureEnabled(key);
  },
  getAnonId() {
    return ensureAnonId();
  },
};

export const analytics: Analytics = KEY ? posthogAnalytics : noopAnalytics;

export function initAnalytics() {
  analytics.init();
  if (hasAnalyticsConsent()) loadGtm();
}

/** Único ponto que liga/desliga o PostHog em runtime. Chamado por cookieConsentSync.ts. */
export function applyCookieConsent(analyticsAccepted: boolean) {
  saveCookieConsent(analyticsAccepted);
  if (analyticsAccepted) {
    analytics.init();
    loadGtm();
    return;
  }
  revokeGtm();
  posthogGeneration++;
  if (posthogInitialized && posthog) {
    posthog.reset();
    posthog.opt_out_capturing();
    posthogInitialized = false;
  }
}

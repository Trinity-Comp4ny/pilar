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
 */

import posthog from "posthog-js";
import { env } from "./env";
import { getCookieConsent, saveCookieConsent } from "./cookieConsent";

type Props = Record<string, unknown>;

export interface AnalyticsTraits {
  email?: string;
  empresa_id?: string;
  role?: string;
  [k: string]: unknown;
}

interface Analytics {
  init(): void;
  identify(userId: string, traits?: AnalyticsTraits): void;
  track(event: string, properties?: Props): void;
  reset(): void;
  isFeatureEnabled(key: string): boolean | undefined;
  getAnonId(): string;
}

const DEV = import.meta.env.DEV;
const KEY = env.VITE_POSTHOG_KEY;
const HOST = env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com";

const SENSITIVE_KEYS =
  /password|senha|token|api_key|secret|authorization|cookie|cpf|cnpj|rg|pix|conta_bancaria|agencia|salario/i;

const PII_PATTERNS: Array<{ re: RegExp; replace: string }> = [
  { re: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, replace: "[CPF]" },
  { re: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, replace: "[CNPJ]" },
  { re: /\b\d{5}-?\d{3}\b/g, replace: "[CEP]" },
  { re: /\b(?:\d[ -]?){13,16}\d\b/g, replace: "[CARD]" },
];

function scrubString(s: string): string {
  let out = s;
  for (const { re, replace } of PII_PATTERNS) {
    out = out.replace(re, replace);
  }
  return out;
}

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[max depth]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    const masked = scrubString(value);
    if (masked.length > 500) return masked.slice(0, 500) + "…";
    return masked;
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((v) => scrub(v, depth + 1));
  }
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEYS.test(k)) {
      result[k] = "***";
    } else {
      result[k] = scrub(v, depth + 1);
    }
  }
  return result;
}

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
    bootstrap: { distinctID: ensureAnonId() },
    sanitize_properties: (props) => scrub(props) as Record<string, unknown>,
  });
  posthogInitialized = true;
}

const posthogAnalytics: Analytics = {
  init() {
    if (!hasAnalyticsConsent()) return;
    ensurePosthogInit();
  },
  identify(userId, traits) {
    if (!hasAnalyticsConsent()) return;
    ensurePosthogInit();
    posthog.identify(userId, scrub(traits) as Record<string, unknown> | undefined);
  },
  track(event, properties) {
    if (!hasAnalyticsConsent()) return;
    ensurePosthogInit();
    posthog.capture(event, scrub(properties) as Record<string, unknown> | undefined);
  },
  reset() {
    if (posthogInitialized) posthog.reset();
  },
  isFeatureEnabled(key) {
    if (!hasAnalyticsConsent() || !posthogInitialized) return undefined;
    return posthog.isFeatureEnabled(key);
  },
  getAnonId() {
    return ensureAnonId();
  },
};

export const analytics: Analytics = KEY ? posthogAnalytics : noopAnalytics;

export function initAnalytics() {
  analytics.init();
}

/** Único ponto que liga/desliga o PostHog em runtime. Chamado por cookieConsentSync.ts. */
export function applyCookieConsent(analyticsAccepted: boolean) {
  saveCookieConsent(analyticsAccepted);
  if (analyticsAccepted) {
    analytics.init();
    return;
  }
  if (posthogInitialized) {
    posthog.opt_out_capturing();
    posthog.reset();
    posthogInitialized = false;
  }
}

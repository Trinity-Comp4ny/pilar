/**
 * Monitoring layer — Sentry-backed com fallback no-op.
 *
 * Ativação:
 *   1. Definir VITE_SENTRY_DSN no .env (obrigatório para envio real)
 *   2. Opcional: VITE_SENTRY_ENV (default: import.meta.env.MODE)
 *   3. Opcional: VITE_SENTRY_TRACES_RATE (default: 0.1) — sample rate de transactions
 *      (legacy: VITE_SENTRY_TRACES_SAMPLE_RATE também aceito)
 *
 * Sem DSN, roda em no-op (console em dev, silêncio em prod).
 */

import * as Sentry from "@sentry/react";
import { env, sentryTracesSampleRate } from "./env";

type Extra = Record<string, unknown>;

export interface MonitoringUser {
  id?: string;
  email?: string;
  empresa_id?: string;
  role?: string;
}

interface Monitoring {
  init(): void;
  /** Retorna o event id (Sentry) quando disponível, para exibir como código de referência. */
  captureException(error: unknown, extra?: Extra): string | undefined;
  captureMessage(message: string, level?: "info" | "warning" | "error", extra?: Extra): void;
  setUser(user: MonitoringUser | null): void;
  addBreadcrumb(message: string, data?: Extra): void;
}

const DEV = import.meta.env.DEV;
const DSN = env.VITE_SENTRY_DSN;
const ENV = env.VITE_SENTRY_ENV ?? import.meta.env.MODE;
// Já validado como número em 0..1 por env.ts, que também resolve o nome legado
// VITE_SENTRY_TRACES_RATE. Antes, `Number(undefined ?? ...)` podia render NaN e uma
// var declarada vazia virava 0 sem ninguém notar.
const TRACES_RATE = sentryTracesSampleRate;

// Rotas públicas / pouco interessantes — drop transactions para economizar quota.
const IGNORED_TX_ROUTES = [/^\/privacidade/, /^\/cliente\/login/, /^\/login/, /^\/forgot-password/];

const SENSITIVE_KEYS =
  /password|senha|token|api_key|secret|authorization|cookie|cpf|cnpj|rg|pix|conta_bancaria|agencia|salario/i;

// Padrões PII brasileiros — mascarados em valores string mesmo quando a key é benigna.
const PII_PATTERNS: Array<{ re: RegExp; replace: string }> = [
  // CPF: 123.456.789-00 ou 12345678900
  { re: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, replace: "[CPF]" },
  // CNPJ: 12.345.678/0001-90 ou 12345678000190
  { re: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, replace: "[CNPJ]" },
  // CEP: 12345-678 ou 12345678
  { re: /\b\d{5}-?\d{3}\b/g, replace: "[CEP]" },
  // Cartão de crédito (16 dígitos com ou sem espaços)
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

const noopMonitoring: Monitoring = {
  init() {
    if (DEV) console.info("[monitoring] no-op mode (no VITE_SENTRY_DSN)");
  },
  captureException(error, extra) {
    if (DEV) console.error("[monitoring] exception", error, scrub(extra));
    return undefined;
  },
  captureMessage(message, level = "info", extra) {
    if (DEV) console[level === "error" ? "error" : "log"]("[monitoring]", message, scrub(extra));
  },
  setUser() {},
  addBreadcrumb(message, data) {
    if (DEV) console.debug("[monitoring] breadcrumb", message, scrub(data));
  },
};

const sentryMonitoring: Monitoring = {
  init() {
    if (!DSN) return;
    Sentry.init({
      dsn: DSN,
      environment: ENV,
      tracesSampleRate: TRACES_RATE,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
      sendDefaultPii: false,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
      ],
      beforeSendTransaction(event) {
        const txName = event.transaction ?? "";
        if (IGNORED_TX_ROUTES.some((re) => re.test(txName))) return null;
        return event;
      },
      beforeSend(event) {
        if (event.request?.data) {
          event.request.data = scrub(event.request.data);
        }
        if (event.extra) {
          event.extra = scrub(event.extra) as Record<string, unknown>;
        }
        if (event.contexts?.state) {
          event.contexts.state = scrub(event.contexts.state) as typeof event.contexts.state;
        }
        return event;
      },
    });
  },
  captureException(error, extra) {
    return Sentry.captureException(error, { extra: scrub(extra) as Record<string, unknown> });
  },
  captureMessage(message, level = "info", extra) {
    Sentry.captureMessage(message, { level, extra: scrub(extra) as Record<string, unknown> });
  },
  setUser(user) {
    if (!user) {
      Sentry.setUser(null);
      return;
    }
    Sentry.setUser({ id: user.id, email: user.email });
    if (user.empresa_id) Sentry.setTag("empresa_id", user.empresa_id);
    if (user.role) Sentry.setTag("role", user.role);
  },
  addBreadcrumb(message, data) {
    Sentry.addBreadcrumb({
      message,
      data: scrub(data) as Record<string, unknown>,
      level: "info",
    });
  },
};

export const monitoring: Monitoring = DSN ? sentryMonitoring : noopMonitoring;

export function initMonitoring() {
  monitoring.init();
}

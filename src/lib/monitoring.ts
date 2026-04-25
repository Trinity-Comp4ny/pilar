/**
 * Monitoring layer — Sentry-backed com fallback no-op.
 *
 * Ativação:
 *   1. Definir VITE_SENTRY_DSN no .env (obrigatório para envio real)
 *   2. Opcional: VITE_SENTRY_ENV (default: import.meta.env.MODE)
 *   3. Opcional: VITE_SENTRY_TRACES_SAMPLE_RATE (default: 0.1)
 *
 * Sem DSN, roda em no-op (console em dev, silêncio em prod).
 */

import * as Sentry from "@sentry/react";

type Extra = Record<string, unknown>;

export interface MonitoringUser {
  id?: string;
  email?: string;
  empresa_id?: string;
  role?: string;
}

interface Monitoring {
  init(): void;
  captureException(error: unknown, extra?: Extra): void;
  captureMessage(message: string, level?: "info" | "warning" | "error", extra?: Extra): void;
  setUser(user: MonitoringUser | null): void;
  addBreadcrumb(message: string, data?: Extra): void;
}

const DEV = import.meta.env.DEV;
const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const ENV = (import.meta.env.VITE_SENTRY_ENV as string | undefined) ?? import.meta.env.MODE;
const TRACES_RATE = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.1);

const SENSITIVE_KEYS = /password|senha|token|api_key|secret|authorization|cookie|cpf|cnpj/i;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[max depth]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (value.length > 500) return value.slice(0, 500) + "…";
    return value;
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
    Sentry.captureException(error, { extra: scrub(extra) as Record<string, unknown> });
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

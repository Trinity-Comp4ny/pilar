/// <reference types="vite/client" />

/** Injetado via `define` no vite.config.ts — commit sha do deploy (ou "dev" fora de build de prod). */
declare const __SENTRY_RELEASE__: string;

/**
 * Injetado via `define` no vite.config.ts a partir de VERCEL_ENV: "production",
 * "preview" (staging/PR preview) ou "development" (local). Separa staging de
 * produção no Sentry sem depender de configurar VITE_SENTRY_ENV manualmente por
 * ambiente na Vercel (ver ADR 0036).
 */
declare const __SENTRY_ENVIRONMENT__: string;

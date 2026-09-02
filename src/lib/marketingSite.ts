/**
 * Domínio do site de marketing (apps/marketing, ADR 0021/0025). Hardcoded como
 * o resto dos links entre os dois apps: não há env var de domínio no front
 * hoje (ver SPEC 043, seção "Dados e contratos").
 */
export const MARKETING_URL = "https://pilarsoft.com.br";

const PRODUCTION_APP_HOST = "app.pilarsoft.com.br";

/**
 * MARKETING_URL só existe em produção: não há LP de staging (decisão de
 * 31/08, o site de marketing é pouco arriscado pra justificar domínio
 * dedicado). Em qualquer outro host (staging, preview da Vercel, localhost)
 * o pulo externo bateria sempre em pilarsoft.com.br de PRODUÇÃO, tirando
 * quem está testando do ambiente que veio a propósito. Rotas que dependiam
 * de MARKETING_URL checam isto primeiro.
 */
export function isProductionAppHost(): boolean {
  return window.location.hostname === PRODUCTION_APP_HOST;
}

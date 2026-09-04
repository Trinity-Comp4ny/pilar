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

const STAGING_APP_HOST = "staging.app.pilarsoft.com.br";

/**
 * Ambiente observado pelo HOST, não pelo build. Existe porque a separação por
 * VERCEL_ENV (ADR 0036) não pegou o staging: 357 erros chegaram no Sentry como
 * "production" contra 1 como "staging", incluindo sessões em
 * staging.app.pilarsoft.com.br, então a triagem de produção vinha misturada com
 * teste em staging. Host é a única fonte que não depende de env var de painel
 * nem sobrevive a um build promovido de um ambiente para outro.
 *
 * Retorna null quando o host não é conhecido (preview da Vercel, localhost),
 * para o chamador cair no valor do build, que ali está certo.
 */
export function appEnvironmentFromHost(): "production" | "staging" | null {
  const host = window.location.hostname;
  if (host === PRODUCTION_APP_HOST) return "production";
  if (host === STAGING_APP_HOST) return "staging";
  return null;
}

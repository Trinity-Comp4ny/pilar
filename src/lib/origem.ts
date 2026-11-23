// Em qual superfície o evento nasceu: o app da equipe, o portal do cliente ou o Pilar Campo.
// Vai como tag `origin` no Sentry e como propriedade no PostHog, para o ultra_admin
// separar o que é de cada um (direção do dono, 23/11/2026).
export type Origem = "app" | "portal" | "campo";

export function origemDaRota(pathname: string): Origem {
  if (/^\/campo(\/|$)/.test(pathname)) return "campo";
  if (/^\/cliente(\/|$)/.test(pathname)) return "portal";
  return "app";
}

export function origemAtual(): Origem {
  return typeof window === "undefined" ? "app" : origemDaRota(window.location.pathname);
}

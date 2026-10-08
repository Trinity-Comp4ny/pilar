// Origem do visitante (SPEC 104): de onde veio quem chega à landing, repassada
// ao link de cadastro do app para ficar gravada na conta. Primeiro toque da
// sessão, em sessionStorage: não é rastreamento entre sites, então não depende
// do consentimento de cookies (o PostHog depende, e por isso não basta).
import { APP_URL } from "../config";

const CHAVE = "pilar_origem";
const PARAMS_ORIGEM = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
] as const;

export function extrairOrigem(search: string, referrer: string, hostAtual: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const origem: Record<string, string> = {};
  for (const p of PARAMS_ORIGEM) {
    const v = params.get(p)?.trim();
    if (v) origem[p] = v.slice(0, 200);
  }
  try {
    const ref = referrer ? new URL(referrer) : null;
    // Navegação interna não é origem.
    if (ref && ref.hostname !== hostAtual) origem.ref = ref.hostname;
  } catch {
    // referrer malformado: ignora
  }
  return origem;
}

export function registrarOrigem(): void {
  try {
    if (sessionStorage.getItem(CHAVE)) return;
    const origem = extrairOrigem(window.location.search, document.referrer, window.location.hostname);
    sessionStorage.setItem(CHAVE, JSON.stringify(origem));
  } catch {
    // sessionStorage indisponível (modo privado antigo): segue sem origem
  }
}

/** Link de cadastro do app com a origem da sessão nos parâmetros. */
export function linkCadastro(): string {
  const url = new URL(`${APP_URL}/cadastro`);
  try {
    const origem = JSON.parse(sessionStorage.getItem(CHAVE) ?? "{}") as Record<string, string>;
    for (const [k, v] of Object.entries(origem)) url.searchParams.set(k, v);
  } catch {
    // sem origem guardada
  }
  return url.toString();
}

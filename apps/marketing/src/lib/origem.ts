// Origem do visitante (SPEC 104): de onde veio quem chega à landing. Ia no link
// de cadastro do app; com o cadastro por convite (SPEC 133) fica guardada aqui
// até o funil da demonstração usá-la. Primeiro toque da
// sessão, em sessionStorage: não é rastreamento entre sites, então não depende
// do consentimento de cookies (o PostHog depende, e por isso não basta).

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

/** Origem guardada no primeiro toque da sessão (ou vazia). */
export function lerOrigem(): Record<string, string> {
  try {
    const bruto = JSON.parse(sessionStorage.getItem(CHAVE) ?? "{}") as unknown;
    return bruto && typeof bruto === "object" ? (bruto as Record<string, string>) : {};
  } catch {
    return {};
  }
}

// Canal de aquisição a partir de UTM e referrer (SPEC 149). IA generativa vem
// separada por produto: o ChatGPT marca utm_source=chatgpt.com nos links que cita.
const CANAIS_POR_HOST: Array<[RegExp, string]> = [
  [/(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com)$/, "chatgpt"],
  [/(^|\.)perplexity\.ai$/, "perplexity"],
  [/(^|\.)(gemini\.google\.com|bard\.google\.com)$/, "gemini"],
  [/(^|\.)claude\.ai$/, "claude"],
  [/(^|\.)copilot\.microsoft\.com$/, "copilot"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "linkedin"],
  [/(^|\.)(instagram\.com)$/, "instagram"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "facebook"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "whatsapp"],
  [/(^|\.)(t\.co|x\.com|twitter\.com)$/, "x"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
];

function canalDoHost(valor: string): string | null {
  const host = valor
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split(/[/?#]/)[0];
  for (const [re, canal] of CANAIS_POR_HOST) if (re.test(host)) return canal;
  return null;
}

/**
 * Canal em uma palavra: anúncio do Google (gclid) e do Meta (fbclid) primeiro,
 * depois utm_source, depois o site que mandou o visitante. Sem nada, "direto".
 */
export function classificarCanal(origem: Record<string, string>): string {
  if (origem.gclid) return "google_ads";
  if (origem.fbclid) return "meta_ads";
  const fonte = origem.utm_source?.trim().toLowerCase();
  if (fonte) {
    return (
      canalDoHost(fonte) ??
      (fonte
        .replace(/[^a-z0-9_.-]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40) ||
        "outro")
    );
  }
  if (origem.ref) return canalDoHost(origem.ref) ?? "outro_site";
  return "direto";
}

const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;

/**
 * Registra o clique em "Agendar demonstração" com o canal de origem. Vai por
 * sendBeacon (sobrevive à saída para o Google Agenda) em text/plain, que não
 * pede preflight de CORS. Sem dado pessoal: canal, UTMs e página. Sem a URL do
 * Supabase configurada, não faz nada.
 */
export function registrarInteresseDemo(local: string): void {
  if (!URL_SUPABASE) return;
  try {
    const origem = lerOrigem();
    const corpo = JSON.stringify({
      canal: classificarCanal(origem),
      origem,
      pagina: `${window.location.pathname}#${local}`.slice(0, 200),
    });
    const url = `${URL_SUPABASE.replace(/\/+$/, "")}/functions/v1/registrar-interesse-demo`;
    const blob = new Blob([corpo], { type: "text/plain" });
    if (navigator.sendBeacon?.(url, blob)) return;
    void fetch(url, { method: "POST", body: corpo, keepalive: true, mode: "no-cors" }).catch(() => undefined);
  } catch {
    // Registro de origem nunca atrapalha o clique.
  }
}

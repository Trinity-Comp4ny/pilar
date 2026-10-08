// Origem do cadastro (SPEC 104): UTMs e quem mandou o visitante, vindos da
// landing (que repassa nos parâmetros do link) ou do próprio referrer quando
// a pessoa chega direto em /cadastro. Fica em raw_user_meta_data.origem e
// aparece no aviso de novo cadastro do ultra-admin. Não depende de
// consentimento de cookies, ao contrário do PostHog.

const CHAVE = "pilar_origem_cadastro";
const PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "ref"];

export type OrigemCadastro = Record<string, string>;

export function extrairOrigemCadastro(search: string, referrer: string, hostAtual: string): OrigemCadastro {
  const params = new URLSearchParams(search);
  const origem: OrigemCadastro = {};
  for (const p of PARAMS) {
    const v = params.get(p)?.trim();
    if (v) origem[p] = v.slice(0, 200);
  }
  if (!origem.ref && referrer) {
    try {
      const host = new URL(referrer).hostname;
      if (host && host !== hostAtual) origem.ref = host;
    } catch {
      // referrer malformado: ignora
    }
  }
  return origem;
}

/** Guarda a origem ao abrir /cadastro (o formulário pode ser enviado bem depois). */
export function guardarOrigemCadastro(): void {
  try {
    const origem = extrairOrigemCadastro(window.location.search, document.referrer, window.location.hostname);
    if (Object.keys(origem).length === 0 && sessionStorage.getItem(CHAVE)) return;
    sessionStorage.setItem(CHAVE, JSON.stringify(origem));
  } catch {
    // sessionStorage indisponível: segue sem origem
  }
}

export function lerOrigemCadastro(): OrigemCadastro | null {
  try {
    const origem = JSON.parse(sessionStorage.getItem(CHAVE) ?? "{}") as OrigemCadastro;
    return Object.keys(origem).length > 0 ? origem : null;
  } catch {
    return null;
  }
}

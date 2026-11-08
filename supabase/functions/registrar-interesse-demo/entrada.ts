// Validação do clique em "Agendar demonstração" (SPEC 149). Só canal, parâmetros
// de campanha e a página: nada que identifique a pessoa.

const CHAVES_ORIGEM = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "ref"];

export type InteresseDemo = { canal: string; origem: Record<string, string>; pagina: string | null };

export function lerInteresseDemo(texto: string): InteresseDemo | null {
  let corpo: unknown;
  try {
    corpo = JSON.parse(texto);
  } catch {
    return null;
  }
  if (!corpo || typeof corpo !== "object") return null;
  const b = corpo as Record<string, unknown>;

  const canal = typeof b.canal === "string" ? b.canal.trim().toLowerCase() : "";
  if (!/^[a-z0-9_.-]{1,40}$/.test(canal)) return null;

  const origem: Record<string, string> = {};
  if (b.origem && typeof b.origem === "object") {
    for (const chave of CHAVES_ORIGEM) {
      const v = (b.origem as Record<string, unknown>)[chave];
      if (typeof v === "string" && v.trim()) origem[chave] = v.trim().slice(0, 200);
    }
  }

  const pagina = typeof b.pagina === "string" && b.pagina.trim() ? b.pagina.trim().slice(0, 200) : null;
  return { canal, origem, pagina };
}

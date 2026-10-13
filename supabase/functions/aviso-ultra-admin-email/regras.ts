// Regras puras do aviso-ultra-admin-email, separadas do index.ts (que chama
// serve() no top-level) pra teste sem ligar servidor.

/** Data do aviso no fuso de quem lê (Brasília), formato curto. */
export function formatarData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** Link relativo do sino vira URL absoluta do app; sem link, cai no painel. */
export function urlAbsoluta(link: string | null, appUrl: string): string {
  const base = appUrl.replace(/\/$/, "");
  if (!link) return `${base}/ultra-admin`;
  if (/^https?:\/\//i.test(link)) return link;
  return `${base}/${link.replace(/^\//, "")}`;
}

/** Tipos em que responder o e-mail fala com alguém do outro lado. */
export function dicaResposta(tipo: string): string | null {
  if (tipo === "novo_cadastro") return "Responda este e-mail para falar direto com quem se cadastrou.";
  return null;
}

/**
 * Links do projeto que vão ao portal (SPEC 164): os de `projetos.links` marcados com
 * `cliente: true`. Só http(s), para nunca virar `javascript:` num `href` do portal.
 */
export interface LinkDoCliente {
  url: string;
  rotulo?: string;
}

export function linksDoCliente(bruto: unknown): LinkDoCliente[] {
  if (!Array.isArray(bruto)) return [];
  const links: LinkDoCliente[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== "object") continue;
    const { url, rotulo, cliente } = item as { url?: unknown; rotulo?: unknown; cliente?: unknown };
    if (cliente !== true || typeof url !== "string") continue;
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      continue;
    }
    if (u.protocol !== "https:" && u.protocol !== "http:") continue;
    const texto = typeof rotulo === "string" ? rotulo.replace(/\s+/g, " ").trim().slice(0, 200) : "";
    links.push(texto ? { url: u.toString(), rotulo: texto } : { url: u.toString() });
    if (links.length >= 100) break;
  }
  return links;
}

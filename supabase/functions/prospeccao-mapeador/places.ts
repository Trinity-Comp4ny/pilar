/**
 * Mapeador de leads (SPEC 172 fase 1): normalização das respostas do Google Places (New).
 * Funções puras, testáveis sem rede.
 */

export interface PlaceBruto {
  id?: string;
  displayName?: { text?: string };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  formattedAddress?: string;
  businessStatus?: string;
}

export interface LeadMapeado {
  place_id: string;
  nome: string;
  telefone: string | null;
  telefone_e164: string | null;
  tipo_telefone: "celular" | "fixo" | "sem";
  site: string | null;
  endereco: string | null;
}

/** Telefone brasileiro → 55DDNNNNNNNNN. Celular tem 9 dígitos locais começando em 9. */
export function normalizarTelefone(
  texto: string | null | undefined
): { e164: string; tipo: "celular" | "fixo" } | null {
  const d = (texto ?? "").replace(/\D/g, "");
  const local = d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
  if (local.length !== 10 && local.length !== 11) return null;
  if (local.startsWith("0") || local.startsWith("00")) return null;
  const numero = local.slice(2);
  const celular = numero.length === 9 && numero.startsWith("9");
  if (numero.length === 9 && !celular) return null;
  return { e164: `55${local}`, tipo: celular ? "celular" : "fixo" };
}

export function mapearLugares(lugares: PlaceBruto[]): LeadMapeado[] {
  const saida: LeadMapeado[] = [];
  const vistos = new Set<string>();
  for (const p of lugares) {
    const id = p.id?.trim();
    const nome = p.displayName?.text?.trim();
    if (!id || !nome || vistos.has(id)) continue;
    if (p.businessStatus && p.businessStatus !== "OPERATIONAL") continue;
    vistos.add(id);
    const tel = normalizarTelefone(p.nationalPhoneNumber ?? p.internationalPhoneNumber);
    saida.push({
      place_id: id,
      nome,
      telefone: p.nationalPhoneNumber ?? null,
      telefone_e164: tel?.e164 ?? null,
      tipo_telefone: tel?.tipo ?? "sem",
      site: p.websiteUri ?? null,
      endereco: p.formattedAddress ?? null,
    });
  }
  return saida;
}

/** Consulta de texto: o rótulo do segmento mais a cidade. */
export function consultaTexto(rotuloBusca: string, cidade: string, uf: string): string {
  return `${rotuloBusca} em ${cidade}, ${uf}`;
}

/** Termo de busca por slug de segmento. */
export const TERMO_BUSCA: Record<string, string> = {
  arquitetura: "escritório de arquitetura",
  engenharia: "escritório de engenharia",
  construtoras: "construtora",
  moveis_planejados: "móveis planejados",
  marmorarias: "marmoraria",
  vidracarias: "vidraçaria",
  esquadrias: "esquadrias de alumínio",
  serralherias: "serralheria",
};

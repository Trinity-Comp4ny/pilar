/**
 * Enriquecimento por CNPJ (SPEC 172 fase 2): lógica pura sobre a resposta da BrasilAPI.
 */

export interface SocioBruto {
  nome_socio?: string;
  qualificacao_socio?: string;
}

export interface CnpjBruto {
  razao_social?: string;
  cnae_fiscal?: number | string;
  codigo_natureza_juridica?: number | string;
  qsa?: SocioBruto[];
}

export interface Enriquecimento {
  razao_social: string | null;
  cnae: string | null;
  decisor: string | null;
  ajuste_nota: number;
}

/** Só dígitos, 14 posições; qualquer outra coisa é inválida. */
export function normalizarCnpj(texto: string | null | undefined): string | null {
  const d = (texto ?? "").replace(/\D/g, "");
  return d.length === 14 ? d : null;
}

/** Divisões de CNAE que confirmam o segmento do lead (2 primeiros dígitos). */
const DIVISOES_POR_SEGMENTO: Record<string, string[]> = {
  arquitetura: ["71"],
  engenharia: ["71"],
  construtoras: ["41", "42", "43"],
  moveis_planejados: ["31", "43"],
  marmorarias: ["23", "43"],
  vidracarias: ["23", "43"],
  esquadrias: ["25", "43"],
  serralherias: ["25", "43"],
};

/** O CNAE principal bate com o segmento? Sem CNAE ou segmento desconhecido: não sabemos (null). */
export function cnaeCompativel(segmento: string, cnae: string | null): boolean | null {
  const divisoes = DIVISOES_POR_SEGMENTO[segmento];
  const c = (cnae ?? "").replace(/\D/g, "");
  if (!divisoes || c.length < 2) return null;
  return divisoes.includes(c.slice(0, 2));
}

const NATUREZA_EMPRESARIO_INDIVIDUAL = "2135";

/** "JOAO DA SILVA 12345678901" → "JOAO DA SILVA" (razão social de MEI e empresário individual). */
function nomeDeEmpresarioIndividual(razao: string): string | null {
  const nome = razao
    .replace(/\d{6,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return nome.length >= 3 ? nome : null;
}

/** Decisor: o titular (empresário individual) ou o sócio-administrador; senão ninguém. */
export function escolherDecisor(c: CnpjBruto): string | null {
  const natureza = String(c.codigo_natureza_juridica ?? "").replace(/\D/g, "");
  if (natureza === NATUREZA_EMPRESARIO_INDIVIDUAL && c.razao_social) {
    return nomeDeEmpresarioIndividual(c.razao_social);
  }
  const adm = (c.qsa ?? []).find((s) => /administrador/i.test(s.qualificacao_socio ?? ""));
  const nome = adm?.nome_socio?.trim();
  return nome ? nome : null;
}

/** Nota: CNAE compatível com o segmento +10, incompatível -25, sem informação 0. */
export function enriquecer(segmento: string, c: CnpjBruto): Enriquecimento {
  const cnae = c.cnae_fiscal != null ? String(c.cnae_fiscal) : null;
  const compat = cnaeCompativel(segmento, cnae);
  return {
    razao_social: c.razao_social?.trim() || null,
    cnae,
    decisor: escolherDecisor(c),
    ajuste_nota: compat === true ? 10 : compat === false ? -25 : 0,
  };
}

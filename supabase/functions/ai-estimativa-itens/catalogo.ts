// SPEC 138 (BEZ-83): o catálogo que a IA pode preencher. A lista de ids é código (o que a IA entende e como conta),
// e o nome e a unidade de cada item vêm dos parâmetros do motor no banco: item que o banco ainda não tem não existe
// para a IA. A IA nunca vê preço.

/** Itens que a IA devolve em `itens`. Marcenaria e relevo têm campo próprio na saída. */
export const IDS_DA_IA = [
  "ac9",
  "ac12",
  "ac18",
  "ac24",
  "aqsolar",
  "fv",
  "automacao",
  "piscina",
  "gourmet",
  "paisagismo",
  "elevador",
  "subsolo",
] as const;
export type IdDaIa = (typeof IDS_DA_IA)[number];

/** Itens que existem ou não: a quantidade é sempre 1, o que a IA devolver além disso é descartado. */
export const SEMPRE_UM: ReadonlySet<IdDaIa> = new Set<IdDaIa>([
  "automacao",
  "gourmet",
  "paisagismo",
  "elevador",
  "subsolo",
]);

interface RegraDoItem {
  /** O que a quantidade significa para este item. */
  comoContar: string;
  /** Como o texto costuma citar o item, para o modelo reconhecer. */
  aparece: string;
}

export const REGRAS: Record<IdDaIa, RegraDoItem> = {
  ac9: { comoContar: "número de aparelhos", aparece: "split de 9.000 BTU, 9k, 9 mil BTU" },
  ac12: { comoContar: "número de aparelhos", aparece: "split de 12.000 BTU, 12k, 12 mil BTU" },
  ac18: { comoContar: "número de aparelhos", aparece: "split de 18.000 BTU, 18k, 18 mil BTU" },
  ac24: { comoContar: "número de aparelhos", aparece: "split de 24.000 BTU, 24k, 24 mil BTU" },
  aqsolar: {
    comoContar: "número de conjuntos (1 quando o texto só cita o aquecedor)",
    aparece: "aquecedor solar, aquecimento solar de água, placas coletoras com reservatório",
  },
  fv: {
    comoContar: "potência do sistema em kWp",
    aparece: "energia solar fotovoltaica, painel solar, placas fotovoltaicas, gerador solar, usina solar",
  },
  automacao: { comoContar: "sempre 1", aparece: "automação residencial, casa inteligente, domótica" },
  piscina: {
    comoContar: "área da piscina em m² (largura x comprimento quando o texto dá as duas medidas)",
    aparece: "piscina, piscina aquecida, piscina com raia",
  },
  gourmet: { comoContar: "sempre 1", aparece: "área gourmet, espaço gourmet, churrasqueira com bancada" },
  paisagismo: { comoContar: "sempre 1", aparece: "paisagismo, jardim projetado, projeto paisagístico" },
  elevador: { comoContar: "sempre 1", aparece: "elevador residencial, elevador social" },
  subsolo: { comoContar: "sempre 1", aparece: "subsolo, garagem no subsolo, adega no subsolo" },
};

export interface ItemPermitido {
  id: IdDaIa;
  rotulo: string;
  unidade: string | null;
  comoContar: string;
  aparece: string;
}

interface AdicionalDoBanco {
  rotulo?: unknown;
  unidade?: unknown;
  escopo?: unknown;
}

/**
 * Itens permitidos agora: os que a IA conhece E que existem nos parâmetros do motor, fora do CUB. `adicionais` é
 * `estimativa_parametros.parametros.adicionais`, lido no servidor (nunca vem do cliente).
 */
export function itensPermitidos(adicionais: unknown): ItemPermitido[] {
  const mapa = (adicionais && typeof adicionais === "object" ? adicionais : {}) as Record<string, AdicionalDoBanco>;
  return IDS_DA_IA.flatMap((id) => {
    const a = mapa[id];
    if (!a || typeof a.rotulo !== "string" || a.escopo === "dentro_do_cub") return [];
    return [
      {
        id,
        rotulo: a.rotulo,
        unidade: typeof a.unidade === "string" ? a.unidade : null,
        ...REGRAS[id],
      },
    ];
  });
}

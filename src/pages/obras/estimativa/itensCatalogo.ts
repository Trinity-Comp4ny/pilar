// Itens que o CUB não cobre, como aparecem no passo "O que a obra tem" (SPEC 137). O preço e a origem de cada
// um vêm do motor (`previaDoItem`); aqui só há agrupamento, controle e texto. Ids são os de `ADICIONAIS_IDS`.
import type { AdicionalId, Ficha } from "@/schemas/estimativaObra";

type Controle = "contador" | "alternar" | "metros" | "marcenaria" | "relevo";

export interface ItemDoCatalogo {
  id: AdicionalId;
  nome: string;
  controle: Controle;
  /** Plural da unidade no controle (aparelhos, kWp, m²). */
  unidade?: string;
  /** Unidade do preço, no singular (aparelho, conjunto, kWp, m²). */
  porUnidade?: string;
  so?: "residencial";
}

export interface GrupoDoCatalogo {
  titulo: string;
  nota?: string;
  itens: ItemDoCatalogo[];
}

export const GRUPOS: GrupoDoCatalogo[] = [
  {
    titulo: "Climatização",
    nota: "O SINAPI traz o aparelho. Tubulação, dreno e instalação você informa depois.",
    itens: [
      { id: "ac9", nome: "Split 9.000 BTU", controle: "contador", unidade: "aparelhos", porUnidade: "aparelho" },
      { id: "ac12", nome: "Split 12.000 BTU", controle: "contador", unidade: "aparelhos", porUnidade: "aparelho" },
      { id: "ac18", nome: "Split 18.000 BTU", controle: "contador", unidade: "aparelhos", porUnidade: "aparelho" },
      { id: "ac24", nome: "Split 24.000 BTU", controle: "contador", unidade: "aparelhos", porUnidade: "aparelho" },
    ],
  },
  {
    titulo: "Aquecimento e energia",
    itens: [
      {
        id: "aqsolar",
        nome: "Aquecedor solar de 1.000 L",
        controle: "alternar",
        porUnidade: "conjunto, sem instalação",
      },
      { id: "fv", nome: "Energia solar fotovoltaica", controle: "contador", unidade: "kWp", porUnidade: "kWp" },
    ],
  },
  { titulo: "Automação", itens: [{ id: "automacao", nome: "Automação residencial", controle: "alternar" }] },
  {
    titulo: "Lazer",
    itens: [
      { id: "piscina", nome: "Piscina", controle: "metros", unidade: "m²", porUnidade: "m²", so: "residencial" },
      { id: "gourmet", nome: "Área gourmet", controle: "alternar", so: "residencial" },
    ],
  },
  {
    titulo: "Área externa e terreno",
    itens: [
      { id: "paisagismo", nome: "Paisagismo", controle: "alternar", porUnidade: "m² de área livre" },
      { id: "terraplenagem", nome: "Terreno inclinado", controle: "relevo" },
    ],
  },
  {
    titulo: "Marcenaria e circulação",
    itens: [
      { id: "marcenaria", nome: "Marcenaria e móveis planejados", controle: "marcenaria" },
      { id: "elevador", nome: "Elevador", controle: "alternar" },
      { id: "subsolo", nome: "Subsolo", controle: "alternar" },
    ],
  },
];

type ItensFicha = Ficha["itens"];

/** Quanto do item a ficha tem. 0 = fora da obra. */
export function quantidadeNaFicha(item: ItemDoCatalogo, ficha: Ficha): number {
  switch (item.id) {
    case "piscina":
      return ficha.piscina;
    case "gourmet":
      return ficha.gourmet ? 1 : 0;
    case "paisagismo":
      return ficha.paisagismo ? 1 : 0;
    case "elevador":
      return ficha.elevador ? 1 : 0;
    case "subsolo":
      return ficha.subsolo ? 1 : 0;
    case "marcenaria":
      return ficha.marcenaria === "nenhuma" ? 0 : 1;
    case "terraplenagem":
      return ficha.topografia === "inclinado" ? 1 : 0;
    default:
      return ficha.itens[item.id] ?? 0;
  }
}

/** Mexe só no campo da ficha que o item controla. Zero tira a chave de `itens`, para a ficha não carregar lixo. */
export function itensSemZero(itens: ItensFicha, id: AdicionalId, n: number): ItensFicha {
  const { [id]: _antigo, ...resto } = itens;
  return n > 0 ? { ...resto, [id]: n } : resto;
}

/** Itens escolhidos, em frases curtas, para a revisão. */
export function resumoDosItens(ficha: Ficha): string[] {
  const residencial = ficha.tipo === "residencial";
  const linhas: string[] = [];
  for (const g of GRUPOS) {
    for (const item of g.itens) {
      if (item.so && !residencial) continue;
      const n = quantidadeNaFicha(item, ficha);
      if (n <= 0) continue;
      if (item.id === "piscina") linhas.push(`piscina de ${n.toLocaleString("pt-BR")} m²`);
      else if (item.id === "marcenaria")
        linhas.push(`marcenaria ${ficha.marcenaria === "basica" ? "básica" : "completa"}`);
      else if (item.id === "terraplenagem") {
        linhas.push(
          ficha.arrimo > 0
            ? `terreno inclinado, ${ficha.arrimo.toLocaleString("pt-BR")} m² de muro de arrimo`
            : "terreno inclinado, muro de arrimo a medir"
        );
      } else if (item.controle === "contador")
        linhas.push(
          `${n.toLocaleString("pt-BR")} ${item.unidade === "kWp" ? "kWp de energia solar" : `× ${item.nome.toLowerCase()}`}`
        );
      else linhas.push(item.nome.toLowerCase());
    }
  }
  return linhas;
}

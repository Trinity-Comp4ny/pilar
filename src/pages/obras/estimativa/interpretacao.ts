// SPEC 138 (BEZ-83): o que a função `ai-estimativa-itens` devolve e como isso entra na ficha. A IA só lê o texto e
// escolhe itens do catálogo com quantidade; preço e origem saem do motor depois que a pessoa confirma a lista.
import { z } from "zod";
import { formatNumber } from "@/lib/format";
import { ADICIONAIS_IDS, type AdicionalId, type Ficha } from "@/schemas/estimativaObra";

export const MAX_DESCRICAO = 2000;
/** Custo médio de uma leitura, dito antes de rodar. O débito real vem do consumo de tokens da chamada. */
export const TOKENS_ESTIMADOS = 4000;

const ambiente = z.number().int().min(0).max(999).nullish();

/** Resposta da função, validada na fronteira: o que não bate vira o estado "resposta inválida" da tela. */
export const interpretacaoSchema = z.object({
  itens: z.array(
    z.object({
      id: z.enum(ADICIONAIS_IDS),
      quantidade: z.number().positive().max(100_000),
      trecho: z.string().default(""),
    })
  ),
  ambientes: z
    .object({ quartos: ambiente, suites: ambiente, banheiros: ambiente, lavabos: ambiente, vagas: ambiente })
    .default({}),
  marcenaria: z.enum(["basica", "completa"]).nullable().default(null),
  relevo: z.object({ inclinado: z.boolean(), arrimo_m2: z.number().nullable() }).nullable().default(null),
  fora_do_catalogo: z.array(z.object({ texto: z.string(), motivo: z.string().nullable().default(null) })).default([]),
  perguntas: z
    .array(z.object({ id: z.enum(ADICIONAIS_IDS).nullable().default(null), pergunta: z.string() }))
    .default([]),
});
export type Interpretacao = z.infer<typeof interpretacaoSchema>;

export interface ItemLido {
  id: AdicionalId;
  quantidade: number;
  trecho: string;
}

/** Itens que só existem em obra residencial: fora dela a ficha os ignora, então a lista não os promete. */
const SO_RESIDENCIAL: ReadonlySet<AdicionalId> = new Set<AdicionalId>(["piscina", "gourmet"]);

export const valeParaOTipo = (id: AdicionalId, tipo: Ficha["tipo"]) =>
  tipo === "residencial" || !SO_RESIDENCIAL.has(id);

type Leitura = Pick<Interpretacao, "ambientes" | "marcenaria" | "relevo"> & { itens: ItemLido[] };

/**
 * Põe na ficha o que a IA leu e a pessoa confirmou. Só mexe no que o texto citou: o resto da ficha fica como
 * está (a leitura soma ao que já foi marcado, nunca zera). Item que não vale para o tipo da obra é ignorado.
 */
export function aplicarInterpretacao(ficha: Ficha, leitura: Leitura): Ficha {
  const residencial = ficha.tipo === "residencial";
  const f: Ficha = { ...ficha, itens: { ...ficha.itens } };
  for (const { id, quantidade } of leitura.itens) {
    if (!valeParaOTipo(id, ficha.tipo)) continue;
    if (id === "piscina") f.piscina = quantidade;
    else if (id === "gourmet") f.gourmet = true;
    else if (id === "paisagismo") f.paisagismo = true;
    else if (id === "elevador") f.elevador = true;
    else if (id === "subsolo") f.subsolo = true;
    else f.itens[id] = quantidade;
  }
  const { quartos, suites, banheiros, lavabos, vagas } = leitura.ambientes;
  if (residencial && quartos != null) f.quartos = quartos;
  if (residencial && suites != null) f.suites = suites;
  if (residencial && lavabos != null) f.lavabo = lavabos;
  if (banheiros != null) f.banheiros = banheiros;
  if (vagas != null) f.vagas = vagas;
  if (leitura.marcenaria) f.marcenaria = leitura.marcenaria;
  if (leitura.relevo?.inclinado) {
    f.topografia = "inclinado";
    if (leitura.relevo.arrimo_m2) f.arrimo = leitura.relevo.arrimo_m2;
  }
  return f;
}

/** Resumo do que a leitura preenche além dos itens, para a pessoa ver antes de confirmar. */
export function frasesDoQueMais(leitura: Pick<Interpretacao, "ambientes" | "marcenaria" | "relevo">): string[] {
  const { quartos, suites, banheiros, lavabos, vagas } = leitura.ambientes;
  const ambientes = (
    [
      ["quarto", quartos],
      ["suíte", suites],
      ["banheiro", banheiros],
      ["lavabo", lavabos],
      ["vaga", vagas],
    ] as const
  ).flatMap(([nome, n]) => (n == null ? [] : [`${n} ${nome}${n === 1 ? "" : "s"}`]));
  const frases: string[] = [];
  if (ambientes.length > 0) frases.push(`Ambientes: ${ambientes.join(", ")}.`);
  if (leitura.marcenaria) frases.push(`Marcenaria ${leitura.marcenaria === "basica" ? "básica" : "completa"}.`);
  if (leitura.relevo?.inclinado) {
    frases.push(
      leitura.relevo.arrimo_m2
        ? `Terreno inclinado com ${formatNumber(leitura.relevo.arrimo_m2)} m² de muro de arrimo.`
        : "Terreno inclinado: o muro de arrimo fica a medir."
    );
  }
  return frases;
}

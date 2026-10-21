import { z } from "../_shared/schemas.ts";
import { IDS_DA_IA, SEMPRE_UM, type IdDaIa } from "./catalogo.ts";

export const MAX_DESCRICAO_CHARS = 2000;
const MIN_DESCRICAO_CHARS = 3;

const inteiro = z.number().int().min(0).max(99).nullable().optional();

/** O que o modelo devolve. Id fora do catálogo reprova na validação e gasta o retry de schema. */
export const SaidaSchema = z.object({
  itens: z
    .array(
      z.object({
        id: z.enum(IDS_DA_IA),
        quantidade: z.number().positive().max(100_000),
        trecho: z.string().max(200).default(""),
      })
    )
    .default([]),
  // O modelo às vezes devolve null em vez de objeto vazio quando o texto não cita ambiente.
  ambientes: z
    .object({
      quartos: inteiro,
      suites: inteiro,
      banheiros: inteiro,
      lavabos: inteiro,
      vagas: inteiro,
    })
    .nullish()
    .transform((v) => v ?? {}),
  marcenaria: z.enum(["basica", "completa"]).nullable().optional(),
  relevo: z
    .object({
      inclinado: z.boolean(),
      arrimo_m2: z.number().positive().max(100_000).nullable().optional(),
    })
    .nullable()
    .optional(),
  fora_do_catalogo: z
    .array(z.object({ texto: z.string().min(1).max(200), motivo: z.string().max(200).nullable().optional() }))
    .default([]),
  perguntas: z
    .array(
      z.object({
        id: z.enum(IDS_DA_IA).nullable().optional(),
        pergunta: z.string().min(1).max(200),
      })
    )
    .default([]),
});
export type Saida = z.infer<typeof SaidaSchema>;

/** Resposta ao cliente: a saída já conferida contra o catálogo do banco. */
export interface Interpretacao {
  itens: { id: IdDaIa; quantidade: number; trecho: string }[];
  ambientes: Saida["ambientes"];
  marcenaria: "basica" | "completa" | null;
  relevo: { inclinado: boolean; arrimo_m2: number | null } | null;
  fora_do_catalogo: { texto: string; motivo: string | null }[];
  perguntas: { id: IdDaIa | null; pergunta: string }[];
}

/**
 * Confere a saída do modelo contra os itens permitidos agora e deixa o resultado pronto para a tela:
 * - id que o banco não tem (ainda) vai para "fora do catálogo", nunca para a ficha;
 * - o mesmo id repetido soma as quantidades (ex.: "4 de 12 mil e mais 2 de 12 mil");
 * - item de existência (automação, gourmet, paisagismo, elevador, subsolo) vale sempre 1;
 * - pergunta sobre item que o banco não tem perde o id.
 */
export function conferirSaida(saida: Saida, permitidos: ReadonlySet<string>): Interpretacao {
  const itens = new Map<IdDaIa, { quantidade: number; trechos: string[] }>();
  const fora: Interpretacao["fora_do_catalogo"] = saida.fora_do_catalogo.map((f) => ({
    texto: f.texto,
    motivo: f.motivo ?? null,
  }));
  for (const item of saida.itens) {
    if (!permitidos.has(item.id)) {
      fora.push({ texto: item.trecho || item.id, motivo: "Este item ainda não está no catálogo" });
      continue;
    }
    const atual = itens.get(item.id) ?? { quantidade: 0, trechos: [] };
    atual.quantidade = Math.min(100_000, Math.round((atual.quantidade + item.quantidade) * 100) / 100);
    if (item.trecho) atual.trechos.push(item.trecho);
    itens.set(item.id, atual);
  }
  return {
    itens: [...itens].map(([id, v]) => ({
      id,
      quantidade: SEMPRE_UM.has(id) ? 1 : v.quantidade,
      trecho: v.trechos.join(" / ").slice(0, 200),
    })),
    ambientes: saida.ambientes,
    marcenaria: saida.marcenaria ?? null,
    relevo: saida.relevo ? { inclinado: saida.relevo.inclinado, arrimo_m2: saida.relevo.arrimo_m2 ?? null } : null,
    fora_do_catalogo: fora,
    perguntas: saida.perguntas.map((p) => ({
      id: p.id && permitidos.has(p.id) ? p.id : null,
      pergunta: p.pergunta,
    })),
  };
}

/** Corpo da requisição: só a descrição, com espaços normalizados e teto de tamanho. */
export function lerEntrada(corpo: unknown): { ok: true; descricao: string } | { ok: false; error: string } {
  const b = (corpo && typeof corpo === "object" ? corpo : {}) as Record<string, unknown>;
  const bruta = typeof b.descricao === "string" ? b.descricao : "";
  // As marcas do prompt não podem ser fechadas de dentro do texto.
  const descricao = bruta
    .replace(/<\/?descricao>/gi, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (descricao.length < MIN_DESCRICAO_CHARS)
    return { ok: false, error: "Descreva a obra para a IA preencher a lista." };
  if (descricao.length > MAX_DESCRICAO_CHARS) {
    return { ok: false, error: `A descrição passa de ${MAX_DESCRICAO_CHARS} caracteres. Resuma e tente de novo.` };
  }
  return { ok: true, descricao };
}

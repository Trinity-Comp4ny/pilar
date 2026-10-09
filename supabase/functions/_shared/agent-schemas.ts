import { z } from "./schemas.ts";

/**
 * Schemas dos artefatos gerados por agentes proativos (cron, sem usuário no loop).
 *
 * Regra: todo agente que grava rascunho no domínio valida a saída contra um destes
 * schemas via callGeminiStructured. Número (valor, horas, total) não sai do modelo: sai do
 * código, a partir da evidência que o modelo cita (ADR 0050).
 */

/** Normaliza nome de disciplina para comparar com o orçamento (maiúscula e espaço nas pontas). */
export function chaveDisciplina(nome: string): string {
  return nome.trim().toLocaleLowerCase("pt-BR");
}

/**
 * Rascunho de aditivo sugerido pelo guardião de margem (spec 081, aterrado pela spec 107)
 * quando um projeto estoura o orçamento vivo (projeto_orcamento_fases) sem nenhum aditivo
 * em aberto cobrindo a diferença.
 *
 * O modelo não escolhe número (ADR 0050): cada item traz descrição, disciplina e as
 * referências das despesas que o sustentam (`D1`, `D2`...). Custo, horas e valor do
 * aditivo são calculados em código a partir dessas despesas (guardiao-margem-cron/aditivo.ts).
 *
 * `disciplinas` são as do orçamento do projeto: disciplina fora delas viraria fase nova no
 * orçamento ao aprovar (handle_escopo_aprovado), então o schema rejeita e o modelo tenta
 * de novo com o erro.
 */
export function montarAditivoSugeridoSchema(disciplinas: readonly string[]) {
  const permitidas = new Set(disciplinas.map(chaveDisciplina));
  const item = z.object({
    descricao: z.string().min(1).describe("O que este item do aditivo cobre"),
    disciplina: z
      .string()
      .refine((v) => permitidas.has(chaveDisciplina(v)), {
        message: `disciplina fora do orçamento do projeto; use uma de: ${disciplinas.join(", ")}`,
      })
      .describe("Disciplina do orçamento do projeto"),
    despesas: z.array(z.string()).min(1).describe("Referências (D1, D2...) das despesas que sustentam o item"),
  });
  return z.object({
    descricao: z.string().min(1).describe("Resumo curto do aditivo (1 linha)"),
    justificativa: z.string().min(1).describe("Por que o escopo aumentou, com base nas despesas citadas"),
    confianca: z.number().min(0).max(1).describe("0 a 1: quão seguro o agente está desta sugestão"),
    itens: z.array(item).min(1).describe("Itens que compõem o aditivo"),
  });
}

export type AditivoSugerido = z.infer<ReturnType<typeof montarAditivoSugeridoSchema>>;

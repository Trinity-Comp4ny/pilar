import { z } from "./schemas.ts";

/**
 * Schemas dos artefatos gerados por agentes proativos (cron, sem usuário no loop).
 *
 * Regra: todo agente que grava rascunho no domínio valida a saída contra um destes
 * schemas via callGeminiStructured. Os campos mapeiam o mais próximo possível das
 * colunas de domínio, para que o rascunho aprovado não precise de transformação.
 */

/**
 * Um item do aditivo sugerido. Mapeia 1:1 para escopo_itens
 * (descricao, disciplina, horas, custo).
 */
export const AditivoItemSchema = z.object({
  descricao: z.string().min(1).describe("O que este item do aditivo cobre"),
  disciplina: z.string().optional().describe("Disciplina afetada, se identificável"),
  horas: z.number().min(0).default(0).describe("Horas adicionais estimadas para este item"),
  custo: z.number().min(0).describe("Custo estimado deste item, em reais"),
});

/**
 * Rascunho de aditivo sugerido pelo guardião de margem (spec 081) quando um
 * projeto estoura o orçamento vivo (projeto_orcamento_fases) sem nenhum
 * aditivo em aberto cobrindo a diferença. Vira 1 linha em `escopos`
 * (tipo='aditivo', status='rascunho') + N em `escopo_itens`.
 */
export const AditivoSugeridoSchema = z.object({
  descricao: z.string().min(1).describe("Resumo curto do aditivo (1 linha)"),
  justificativa: z.string().min(1).describe("Por que o escopo aumentou, com base nas despesas e no projeto"),
  confianca: z.number().min(0).max(1).describe("0 a 1: quão seguro o agente está desta sugestão"),
  itens: z.array(AditivoItemSchema).min(1).describe("Itens que compõem o aditivo"),
});

export type AditivoItem = z.infer<typeof AditivoItemSchema>;
export type AditivoSugerido = z.infer<typeof AditivoSugeridoSchema>;

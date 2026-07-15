import { z } from "./schemas.ts";

/**
 * Schemas dos artefatos gerados pelos agentes.
 *
 * Regra: todo agente que grava em agent_runs valida sua saída contra um destes
 * schemas via callGeminiStructured. Os campos mapeiam o mais próximo possível
 * das colunas de domínio, para que o draft aprovado vá ao banco sem transformação.
 */

/**
 * Uma fase/disciplina do orçamento de honorários.
 * Mapeia 1:1 para as colunas de projeto_orcamento_fases:
 * disciplina, horas_estimadas, custo_hora, margem_alvo_pct.
 * (custo_estimado é GENERATED no banco = horas × custo_hora.)
 */
export const OrcamentoFaseSchema = z.object({
  disciplina: z.string().min(1).describe("Disciplina (ex: Arquitetura, Estrutural, Elétrica, Hidráulica)"),
  horas_estimadas: z.number().positive().describe("Total de horas estimadas para a disciplina"),
  custo_hora: z.number().positive().describe("Custo interno por hora, em reais"),
  margem_alvo_pct: z.number().min(0).max(100).describe("Margem alvo, em % sobre o custo"),
  observacao: z.string().optional().describe("Observação opcional sobre a estimativa"),
});

/**
 * Orçamento de honorários completo gerado pelo agente.
 * `fases` é o coração — vira linhas em projeto_orcamento_fases na aprovação.
 */
export const OrcamentoSchema = z.object({
  resumo: z.string().describe("Resumo executivo do orçamento sugerido"),
  fases: z.array(OrcamentoFaseSchema).min(1).describe("Itens do orçamento, um por disciplina"),
  premissas: z.array(z.string()).default([]).describe("Premissas adotadas na estimativa"),
  riscos: z.array(z.string()).default([]).describe("Riscos identificados"),
  perguntas_faltantes: z.array(z.string()).default([]).describe("Informações que faltam para refinar o orçamento"),
});

export type OrcamentoFase = z.infer<typeof OrcamentoFaseSchema>;
export type Orcamento = z.infer<typeof OrcamentoSchema>;

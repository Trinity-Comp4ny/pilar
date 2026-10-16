/**
 * Leitura do Time de agentes (SPEC 126). Tabelas `ops_*` e RPCs só abrem para ultra
 * admin com MFA (RLS + is_ultra_admin no banco). O `ops_receita` devolve jsonb, então
 * o shape é validado aqui na entrada: se a RPC mudar, a tela falha clara em vez de
 * mostrar número errado.
 */
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tabelas = Database["public"]["Tables"];
export type OpsAgente = Tabelas["ops_agentes"]["Row"];
type ExecucaoRow = Tabelas["ops_execucoes"]["Row"];
export type OpsExecucao = Pick<
  ExecucaoRow,
  "id" | "agente_id" | "gatilho" | "inicio" | "fim" | "status" | "custo_usd" | "erro"
> & { briefing: Briefing | null };
export type OpsAcao = Pick<
  Tabelas["ops_acoes"]["Row"],
  "id" | "agente_id" | "tipo" | "titulo" | "prioridade" | "prazo" | "empresa_id" | "created_at"
> & { rascunho: Rascunho | null };

/** Briefing gravado pelo executor (ops-agente-run). jsonb: validado na entrada. */
const BriefingSchema = z.object({
  fonte: z.enum(["modelo", "regra"]),
  resumo: z.string(),
  destaques: z.array(z.object({ texto: z.string(), refs: z.array(z.string()) })).default([]),
});
type Briefing = z.infer<typeof BriefingSchema>;

const RascunhoSchema = z.object({
  canal: z.enum(["whatsapp", "alerta"]),
  texto: z.string(),
  telefone: z.string().nullable().optional(),
  contato: z.string().nullable().optional(),
  link: z.string().optional(),
});
type Rascunho = z.infer<typeof RascunhoSchema>;

/** jsonb que não bate com o schema vira null: a tela mostra "sem briefing", não quebra. */
function lerJson<S extends z.ZodTypeAny>(schema: S, valor: unknown): z.output<S> | null {
  const r = schema.safeParse(valor);
  return r.success ? r.data : null;
}
export type SaudeEmpresa = Database["public"]["Functions"]["ops_saude_empresas"]["Returns"][number];

const contato = {
  contato_nome: z.string().nullable(),
  contato_telefone: z.string().nullable(),
};

const numero = z.coerce.number();

export const ReceitaSchema = z.object({
  dias: numero,
  gerado_em: z.string(),
  cadastros: numero,
  cadastros_anterior: numero,
  ativados: numero,
  ativados_anterior: numero,
  novos_pagantes: numero,
  novos_pagantes_anterior: numero,
  pagantes: numero,
  mrr: numero,
  em_teste: numero,
  checkout_pendente: numero,
  testes_vencendo: z.array(
    z.object({
      empresa_id: z.string(),
      empresa_nome: z.string(),
      vence_em: z.string(),
      projetos: numero,
      ...contato,
    })
  ),
  em_atraso: z.array(
    z.object({
      empresa_id: z.string(),
      empresa_nome: z.string(),
      desde: z.string().nullable(),
      ...contato,
    })
  ),
  por_origem: z.array(
    z.object({
      fonte: z.string(),
      campanha: z.string(),
      cadastros: numero,
      ativados: numero,
      pagantes: numero,
    })
  ),
});

export type Receita = z.infer<typeof ReceitaSchema>;

export async function buscarReceita(dias: number): Promise<Receita> {
  const { data, error } = await supabase.rpc("ops_receita", { p_dias: dias });
  if (error) throw error;
  return ReceitaSchema.parse(data);
}

export async function buscarSaude(): Promise<SaudeEmpresa[]> {
  const { data, error } = await supabase.rpc("ops_saude_empresas");
  if (error) throw error;
  return data ?? [];
}

export async function listarAgentes(): Promise<OpsAgente[]> {
  const { data, error } = await supabase.from("ops_agentes").select("*").order("ordem");
  if (error) throw error;
  return data ?? [];
}

export async function listarAcoesPendentes(): Promise<OpsAcao[]> {
  const { data, error } = await supabase
    .from("ops_acoes")
    .select("id, agente_id, tipo, titulo, prioridade, prazo, empresa_id, created_at, rascunho")
    .eq("status", "pendente")
    .order("prioridade")
    .order("prazo", { nullsFirst: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((a) => ({ ...a, rascunho: lerJson(RascunhoSchema, a.rascunho) }));
}

const COLUNAS_EXECUCAO = "id, agente_id, gatilho, inicio, fim, status, custo_usd, erro, briefing";

function lerExecucao(e: Omit<OpsExecucao, "briefing"> & { briefing: unknown }): OpsExecucao {
  return { ...e, briefing: lerJson(BriefingSchema, e.briefing) };
}

/** Última execução de cada agente (a lista vem do mais recente para o mais antigo). */
export async function listarUltimasExecucoes(): Promise<Map<string, OpsExecucao>> {
  const { data, error } = await supabase
    .from("ops_execucoes")
    .select(COLUNAS_EXECUCAO)
    .order("inicio", { ascending: false })
    .limit(100);
  if (error) throw error;
  const ultimas = new Map<string, OpsExecucao>();
  for (const e of data ?? []) if (!ultimas.has(e.agente_id)) ultimas.set(e.agente_id, lerExecucao(e));
  return ultimas;
}

/** Execuções de um agente nos últimos 30 dias: histórico e custo do período. */
export async function listarExecucoesDoAgente(agenteId: string): Promise<OpsExecucao[]> {
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("ops_execucoes")
    .select(COLUNAS_EXECUCAO)
    .eq("agente_id", agenteId)
    .gte("inicio", desde)
    .order("inicio", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map(lerExecucao);
}

export async function decidirAcao(input: {
  acaoId: string;
  decisao: "enviada" | "descartada";
  texto?: string | null;
  motivo?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc("ops_decidir_acao", {
    p_acao_id: input.acaoId,
    p_decisao: input.decisao,
    p_texto: input.texto ?? undefined,
    p_motivo: input.motivo ?? undefined,
  });
  if (error) throw error;
}

export async function definirAgenteAtivo(agenteId: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.rpc("ops_definir_agente_ativo", { p_agente_id: agenteId, p_ativo: ativo });
  if (error) throw error;
}

/** "Rodar agora": a mesma Edge Function do cron, com o JWT do ultra admin. */
export async function rodarAgente(agenteId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("ops-agente-run", { body: { agente_id: agenteId } });
  if (error) throw error;
}

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
export type OpsExecucao = Pick<Tabelas["ops_execucoes"]["Row"], "id" | "agente_id" | "inicio" | "fim" | "status">;
export type OpsAcao = Pick<
  Tabelas["ops_acoes"]["Row"],
  "id" | "agente_id" | "tipo" | "titulo" | "prioridade" | "prazo" | "empresa_id" | "created_at"
>;
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
    .select("id, agente_id, tipo, titulo, prioridade, prazo, empresa_id, created_at")
    .eq("status", "pendente")
    .order("prioridade")
    .order("prazo", { nullsFirst: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

/** Última execução de cada agente (a lista vem do mais recente para o mais antigo). */
export async function listarUltimasExecucoes(): Promise<Map<string, OpsExecucao>> {
  const { data, error } = await supabase
    .from("ops_execucoes")
    .select("id, agente_id, inicio, fim, status")
    .order("inicio", { ascending: false })
    .limit(100);
  if (error) throw error;
  const ultimas = new Map<string, OpsExecucao>();
  for (const e of data ?? []) if (!ultimas.has(e.agente_id)) ultimas.set(e.agente_id, e);
  return ultimas;
}

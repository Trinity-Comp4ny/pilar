import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { formatDecimal } from "@/lib/format";

export interface UsoEmpresaRow {
  empresaId: string;
  empresaNome: string;
  planoNome: string | null;
  chamadas: number;
  tokensTotal: number;
  custo: number;
  receita: number | null;
  margem: number | null;
  tokensHoje: number;
  mediaAnteriorGasto: number;
  anomaliaGasto: boolean;
}

export interface UsoAgenteRow {
  agentKey: string;
  chamadas: number;
  tokensTotal: number;
  custo: number;
}

export interface Requisicao {
  id: string;
  quando: string;
  empresaId: string;
  empresaNome: string;
  agentKey: string;
  model: string | null;
  tokensInput: number;
  tokensOutput: number;
  custo: number;
}

export interface CustosIa {
  porEmpresa: UsoEmpresaRow[];
  porAgente: UsoAgenteRow[];
  totais: { custo: number; receita: number; chamadas: number; tokens: number; anomalias: number };
}

function mesmoMes(mes: string): boolean {
  const d = new Date(mes);
  const now = new Date();
  return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
}

// ai_token_ledger.custo_estimado vem de ai_model_precos, no preço público do
// provedor (USD). O câmbio de referência (R$5,50) é o mesmo do MOTOR_DE_TOKENS.md
// e do DECISOES.md de 2026-09-01: só pra leitura no painel, o ledger segue em USD.
export const USD_BRL_REFERENCIA = 5.5;
export const emBrl = (usd: number) => usd * USD_BRL_REFERENCIA;

/**
 * Custo de IA em reais. Chamada unitária costuma custar fração de centavo, e
 * com 2 casas tudo viraria "R$ 0,00": abaixo de 1 centavo mostra 4 casas.
 */
export function useFormatCusto() {
  const mask = useMoneyMask();
  return useCallback(
    (valor: number) => {
      const formatado = mask(valor, { decimals: 2 });
      if (valor === 0 || Math.abs(valor) >= 0.01 || formatado.includes("•")) return formatado;
      return `R$ ${formatDecimal(valor, 4)}`;
    },
    [mask]
  );
}

/**
 * Uso e custo da IA no mês corrente, cross-tenant (motor de tokens, spec 076
 * Fase 5). Lê as views por empresa/agente com bypass is_ultra_admin() (migration
 * 20260881000000). Receita = preço de tabela do plano pago + pacotes pagos no mês.
 */
export function useCustosIa() {
  return useQuery({
    queryKey: ["ultra-admin", "custos-ia"],
    staleTime: 60_000,
    queryFn: async (): Promise<CustosIa> => {
      const [
        { data: usoEmpresa, error: e1 },
        { data: empresas, error: e2 },
        { data: subs, error: e3 },
        { data: usoAgente, error: e4 },
        { data: compras, error: e5 },
        { data: anomalias, error: e6 },
      ] = await Promise.all([
        supabase
          .from("v_uso_tokens_por_empresa")
          .select("empresa_id, mes, eventos, tokens_input, tokens_output, custo_estimado"),
        supabase.from("empresas").select("id, nome"),
        supabase
          .from("pilar_subscriptions")
          .select("empresa_id, status, asaas_subscription_id, pilar_subscription_plans(nome, preco_mensal)"),
        supabase
          .from("v_uso_tokens_por_agente")
          .select("agent_key, mes, eventos, tokens_input, tokens_output, custo_estimado"),
        supabase.from("pilar_token_pack_purchases").select("empresa_id, valor_centavos, paid_at").eq("status", "paid"),
        supabase
          .from("v_uso_tokens_anomalia_diaria")
          .select("empresa_id, tokens_hoje, media_dias_anteriores, anomalia"),
      ]);
      for (const e of [e1, e2, e3, e4, e5, e6]) if (e) throw e;

      // Gasto anômalo hoje (SPEC 085): a view faz a conta (10x a média, com piso).
      const anomaliaPorEmpresa = new Map(
        (anomalias ?? []).map((a) => [
          a.empresa_id as string,
          {
            tokensHoje: Number(a.tokens_hoje ?? 0),
            media: Number(a.media_dias_anteriores ?? 0),
            anomalia: Boolean(a.anomalia),
          },
        ])
      );

      // Pacote avulso (SPEC 077) pago no mês: dinheiro de verdade, nunca pending.
      const pacotes = new Map<string, number>();
      for (const c of compras ?? []) {
        if (!c.paid_at || !mesmoMes(c.paid_at as string)) continue;
        const id = c.empresa_id as string;
        pacotes.set(id, (pacotes.get(id) ?? 0) + Number(c.valor_centavos ?? 0) / 100);
      }

      const nomeEmpresa = new Map((empresas ?? []).map((e) => [e.id as string, e.nome as string]));
      const planoAtivo = new Map(
        (subs ?? [])
          .filter((s) => s.status === "active" || s.status === "trialing")
          .map((s) => [
            s.empresa_id as string,
            {
              plano: s.pilar_subscription_plans as { nome: string; preco_mensal: number } | null,
              // Convidada (sem Asaas) não gera receita, mesmo com plano ativo.
              pagante: !!s.asaas_subscription_id,
            },
          ])
      );

      const porEmpresa: UsoEmpresaRow[] = (usoEmpresa ?? [])
        .filter((r) => mesmoMes(r.mes as string))
        .map((r) => {
          const id = r.empresa_id as string;
          const info = planoAtivo.get(id) ?? null;
          const custo = emBrl(Number(r.custo_estimado ?? 0));
          const receitaPlano = info?.pagante ? (info.plano?.preco_mensal ?? null) : null;
          const receitaPacotes = pacotes.get(id) ?? 0;
          const receita = receitaPlano != null || receitaPacotes > 0 ? (receitaPlano ?? 0) + receitaPacotes : null;
          const anomalia = anomaliaPorEmpresa.get(id) ?? null;
          return {
            empresaId: id,
            empresaNome: nomeEmpresa.get(id) ?? id,
            planoNome: info?.plano?.nome ?? null,
            chamadas: Number(r.eventos ?? 0),
            tokensTotal: Number(r.tokens_input ?? 0) + Number(r.tokens_output ?? 0),
            custo,
            receita,
            margem: receita != null ? receita - custo : null,
            tokensHoje: anomalia?.tokensHoje ?? 0,
            mediaAnteriorGasto: anomalia?.media ?? 0,
            anomaliaGasto: anomalia?.anomalia ?? false,
          };
        });

      const agentes = new Map<string, UsoAgenteRow>();
      for (const r of usoAgente ?? []) {
        if (!mesmoMes(r.mes as string)) continue;
        const key = r.agent_key as string;
        const atual = agentes.get(key) ?? { agentKey: key, chamadas: 0, tokensTotal: 0, custo: 0 };
        atual.chamadas += Number(r.eventos ?? 0);
        atual.tokensTotal += Number(r.tokens_input ?? 0) + Number(r.tokens_output ?? 0);
        atual.custo += emBrl(Number(r.custo_estimado ?? 0));
        agentes.set(key, atual);
      }
      const porAgente = Array.from(agentes.values());

      const totais = {
        custo: porAgente.reduce((s, a) => s + a.custo, 0),
        chamadas: porAgente.reduce((s, a) => s + a.chamadas, 0),
        tokens: porAgente.reduce((s, a) => s + a.tokensTotal, 0),
        receita: porEmpresa.reduce((s, e) => s + (e.receita ?? 0), 0),
        anomalias: porEmpresa.filter((e) => e.anomaliaGasto).length,
      };

      return { porEmpresa, porAgente, totais };
    },
  });
}

/** Últimas chamadas de IA (ledger de consumo), com modelo, tokens e custo de cada uma. */
export function useUltimasRequisicoes(limite = 50) {
  return useQuery({
    queryKey: ["ultra-admin", "custos-ia", "requisicoes", limite],
    staleTime: 30_000,
    queryFn: async (): Promise<Requisicao[]> => {
      const [{ data, error }, { data: empresas, error: e2 }] = await Promise.all([
        supabase
          .from("ai_token_ledger")
          .select("id, created_at, empresa_id, agent_key, model, tokens_input, tokens_output, custo_estimado")
          .eq("source", "usage")
          .order("created_at", { ascending: false })
          .limit(limite),
        supabase.from("empresas").select("id, nome"),
      ]);
      if (error) throw error;
      if (e2) throw e2;
      const nome = new Map((empresas ?? []).map((e) => [e.id as string, e.nome as string]));
      return (data ?? []).map((r) => ({
        id: r.id,
        quando: r.created_at,
        empresaId: r.empresa_id,
        empresaNome: nome.get(r.empresa_id) ?? r.empresa_id,
        agentKey: r.agent_key,
        model: r.model,
        tokensInput: r.tokens_input,
        tokensOutput: r.tokens_output,
        custo: emBrl(Number(r.custo_estimado ?? 0)),
      }));
    },
  });
}

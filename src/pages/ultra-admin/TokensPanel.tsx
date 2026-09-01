import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { toDataSourceResult } from "@/types/dataSource";
import { formatCurrency, formatNumberCompact } from "@/lib/format";
import { agentKeyLabel } from "@/components/settings/useExtratoTokens";

interface UsoEmpresaRow {
  empresaId: string;
  empresaNome: string;
  planoNome: string | null;
  tokensTotal: number;
  custoEstimado: number;
  receitaEstimada: number | null;
  margemEstimada: number | null;
}

interface UsoAgenteRow {
  agentKey: string;
  eventos: number;
  tokensTotal: number;
  custoEstimado: number;
}

function mesmoMes(mes: string): boolean {
  const d = new Date(mes);
  const now = new Date();
  return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
}

// ai_token_ledger.custo_estimado é calculado a partir de ai_model_precos, que segue
// o preço público do provedor (USD — ver seed do Gemini 2.5 Flash na migration
// 20260867000000). O câmbio de referência (R$5,50) é o mesmo usado no MOTOR_DE_TOKENS.md
// e no DECISOES.md de 2026-09-01: só para leitura neste painel, nunca grava BRL no
// ledger (o COGS snapshot fica em USD, moeda nativa do provedor, de propósito).
const USD_BRL_REFERENCIA = 5.5;
function custoEmBrl(custoUsd: number): number {
  return custoUsd * USD_BRL_REFERENCIA;
}

// Painel cross-tenant de custo/margem da camada de IA (motor de tokens, spec 076,
// Fase 5). Lê as views por empresa/agente (RLS com bypass de is_ultra_admin(), ver
// migration 20260881000000) — nenhum edge function novo, mesmo padrão de leitura
// direta já usado pelo ultra-admin em admin_audit_logs/profiles.
export function TokensPanel() {
  const query = useQuery({
    queryKey: ["ultra-admin-tokens"],
    queryFn: async () => {
      const [
        { data: usoEmpresa, error: e1 },
        { data: empresas, error: e2 },
        { data: subs, error: e3 },
        { data: usoAgente, error: e4 },
      ] = await Promise.all([
        supabase
          .from("v_uso_tokens_por_empresa")
          .select("empresa_id, mes, tokens_input, tokens_output, custo_estimado"),
        supabase.from("empresas").select("id, nome"),
        supabase.from("pilar_subscriptions").select("empresa_id, status, pilar_subscription_plans(nome, preco_mensal)"),
        supabase
          .from("v_uso_tokens_por_agente")
          .select("agent_key, mes, eventos, tokens_input, tokens_output, custo_estimado"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;
      if (e4) throw e4;

      const nomeEmpresa = new Map((empresas ?? []).map((e) => [e.id as string, e.nome as string]));
      const planoAtivo = new Map(
        (subs ?? [])
          .filter((s) => s.status === "active" || s.status === "trialing")
          .map((s) => [
            s.empresa_id as string,
            s.pilar_subscription_plans as { nome: string; preco_mensal: number } | null,
          ])
      );

      const porEmpresa: UsoEmpresaRow[] = (usoEmpresa ?? [])
        .filter((r) => mesmoMes(r.mes as string))
        .map((r) => {
          const plano = planoAtivo.get(r.empresa_id as string) ?? null;
          // custo_estimado vem em USD (COGS nativo do provedor); receita é BRL
          // (preco_mensal do plano) — converte ANTES de subtrair, nunca mistura moeda.
          const custoBrl = custoEmBrl(Number(r.custo_estimado ?? 0));
          const receita = plano?.preco_mensal ?? null;
          return {
            empresaId: r.empresa_id as string,
            empresaNome: nomeEmpresa.get(r.empresa_id as string) ?? (r.empresa_id as string),
            planoNome: plano?.nome ?? null,
            tokensTotal: Number(r.tokens_input ?? 0) + Number(r.tokens_output ?? 0),
            custoEstimado: custoBrl,
            receitaEstimada: receita,
            margemEstimada: receita != null ? receita - custoBrl : null,
          };
        });

      const porAgenteMapa = new Map<string, UsoAgenteRow>();
      for (const r of usoAgente ?? []) {
        if (!mesmoMes(r.mes as string)) continue;
        const key = r.agent_key as string;
        const atual = porAgenteMapa.get(key) ?? { agentKey: key, eventos: 0, tokensTotal: 0, custoEstimado: 0 };
        atual.eventos += Number(r.eventos ?? 0);
        atual.tokensTotal += Number(r.tokens_input ?? 0) + Number(r.tokens_output ?? 0);
        atual.custoEstimado += custoEmBrl(Number(r.custo_estimado ?? 0));
        porAgenteMapa.set(key, atual);
      }

      return { porEmpresa, porAgente: Array.from(porAgenteMapa.values()) };
    },
  });

  const porEmpresa = useMemo(() => query.data?.porEmpresa ?? [], [query.data]);
  const porAgente = useMemo(() => query.data?.porAgente ?? [], [query.data]);

  const columnsEmpresa: ColumnDef<UsoEmpresaRow>[] = [
    { key: "empresaNome", header: "Empresa", cell: (r) => <span className="text-ink">{r.empresaNome}</span> },
    {
      key: "planoNome",
      header: "Plano",
      cell: (r) => <span className="text-black/60">{r.planoNome ?? "sem assinatura"}</span>,
    },
    {
      key: "tokensTotal",
      header: "Tokens (mês)",
      cell: (r) => <span className="tabular-nums text-ink">{formatNumberCompact(r.tokensTotal)}</span>,
      getSortValue: (r) => r.tokensTotal,
    },
    {
      key: "custoEstimado",
      header: "COGS",
      cell: (r) => (
        <span className="tabular-nums text-black/70">{formatCurrency(r.custoEstimado, { decimals: 2 })}</span>
      ),
      getSortValue: (r) => r.custoEstimado,
    },
    {
      key: "receitaEstimada",
      header: "Receita est.",
      cell: (r) => (
        <span className="tabular-nums text-black/70">
          {r.receitaEstimada != null ? formatCurrency(r.receitaEstimada, { decimals: 2 }) : "—"}
        </span>
      ),
      getSortValue: (r) => r.receitaEstimada ?? 0,
    },
    {
      key: "margemEstimada",
      header: "Margem est.",
      cell: (r) => (
        <span className="tabular-nums text-ink">
          {r.margemEstimada != null ? formatCurrency(r.margemEstimada, { decimals: 2 }) : "—"}
        </span>
      ),
      getSortValue: (r) => r.margemEstimada ?? 0,
    },
  ];

  const columnsAgente: ColumnDef<UsoAgenteRow>[] = [
    { key: "agentKey", header: "Agente", cell: (r) => <span className="text-ink">{agentKeyLabel(r.agentKey)}</span> },
    {
      key: "eventos",
      header: "Chamadas",
      cell: (r) => <span className="tabular-nums text-black/70">{formatNumberCompact(r.eventos)}</span>,
      getSortValue: (r) => r.eventos,
    },
    {
      key: "tokensTotal",
      header: "Tokens",
      cell: (r) => <span className="tabular-nums text-ink">{formatNumberCompact(r.tokensTotal)}</span>,
      getSortValue: (r) => r.tokensTotal,
    },
    {
      key: "custoEstimado",
      header: "COGS",
      cell: (r) => (
        <span className="tabular-nums text-black/70">{formatCurrency(r.custoEstimado, { decimals: 2 })}</span>
      ),
      getSortValue: (r) => r.custoEstimado,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
          <Coins size={18} className="text-black/40" /> Motor de tokens — uso e margem (mês corrente)
        </h3>
        <p className="text-sm text-black/55">
          Receita estimada é o preço de tabela do plano ativo, não o valor de fato cobrado no Asaas. COGS convertido de
          USD (câmbio de referência R$5,50) — o ledger guarda o custo em USD, moeda nativa do provedor. Números de
          lançamento (DECISOES.md 2026-09-01), calibrar com dado real de produção.
        </p>
      </div>

      <div>
        <h4 className="text-sm font-medium text-ink mb-2">Por empresa</h4>
        <DataTable
          columns={columnsEmpresa}
          data={toDataSourceResult<UsoEmpresaRow>({ data: porEmpresa, isLoading: query.isLoading, error: query.error })}
          rowKey={(r) => r.empresaId}
          defaultSortKey="tokensTotal"
          defaultSortDir="desc"
          emptyMessage="Nenhum uso de IA registrado neste mês."
          errorTitle="Não foi possível carregar o uso por empresa"
        />
      </div>

      <div>
        <h4 className="text-sm font-medium text-ink mb-2">Por agente (todas as empresas)</h4>
        <DataTable
          columns={columnsAgente}
          data={toDataSourceResult<UsoAgenteRow>({ data: porAgente, isLoading: query.isLoading, error: query.error })}
          rowKey={(r) => r.agentKey}
          defaultSortKey="tokensTotal"
          defaultSortDir="desc"
          emptyMessage="Nenhum uso de IA registrado neste mês."
          errorTitle="Não foi possível carregar o uso por agente"
        />
      </div>
    </div>
  );
}

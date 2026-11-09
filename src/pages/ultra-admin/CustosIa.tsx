import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Coins, Info, Receipt, TrendingUp, Zap } from "lucide-react";
import { PilarPage } from "@/components/PilarPage";
import { KPICard } from "@/components/KPICard";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ViewSwitcher, type ViewOption } from "@/components/ViewSwitcher";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { agentKeyLabel } from "@/components/settings/useExtratoTokens";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatNumberCompact } from "@/lib/format";
import { toDataSourceResult } from "@/types/dataSource";
import {
  USD_BRL_REFERENCIA,
  useCustosIa,
  useFormatCusto,
  useUltimasRequisicoes,
  type Requisicao,
  type UsoAgenteRow,
  type UsoEmpresaRow,
} from "./custos";
import { quandoRelativo } from "./lib";

type Aba = "empresas" | "agentes" | "chamadas";

const ABAS_CUSTOS: ViewOption<Aba>[] = [
  { value: "empresas", label: "Por empresa" },
  { value: "agentes", label: "Por agente" },
  { value: "chamadas", label: "Últimas chamadas" },
];

/**
 * Custos de IA (motor de tokens, spec 076; redesenho SPEC 117): quanto a IA
 * custou no mês, por empresa, por agente e por chamada. Fonte de verdade é o
 * ai_token_ledger no banco (custo gravado por chamada), não o Sentry.
 */
export default function CustosIa() {
  usePageTitle("Custos de IA · Ultra admin");
  const navigate = useNavigate();
  const [aba, setAba] = useState<Aba>("empresas");
  const query = useCustosIa();
  const requisicoesQ = useUltimasRequisicoes(100);
  const formatCusto = useFormatCusto();
  const t = query.data?.totais;
  const margem = t ? t.receita - t.custo : 0;

  const porChamada = (custo: number, chamadas: number) => (chamadas > 0 ? formatCusto(custo / chamadas) : "-");

  const colunasEmpresa: ColumnDef<UsoEmpresaRow>[] = [
    {
      key: "empresa",
      header: "Empresa",
      getSortValue: (r) => r.empresaNome,
      cell: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink">{r.empresaNome}</span>
          {r.anomaliaGasto && (
            <Badge
              variant="warning"
              className="gap-1"
              title={`Hoje: ${formatNumberCompact(r.tokensHoje)} tokens. Média: ${formatNumberCompact(r.mediaAnteriorGasto)}/dia.`}
            >
              <AlertTriangle size={11} />
              Gasto alto hoje
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "chamadas",
      header: "Chamadas",
      align: "end",
      getSortValue: (r) => r.chamadas,
      cell: (r) => <span className="tabular-nums text-ink-soft">{formatNumberCompact(r.chamadas)}</span>,
    },
    {
      key: "tokens",
      header: "Tokens",
      align: "end",
      getSortValue: (r) => r.tokensTotal,
      cell: (r) => <span className="tabular-nums text-ink-soft">{formatNumberCompact(r.tokensTotal)}</span>,
    },
    {
      key: "custo",
      header: "Custo",
      align: "end",
      getSortValue: (r) => r.custo,
      cell: (r) => <span className="tabular-nums text-ink">{formatCusto(r.custo)}</span>,
    },
    {
      key: "porChamada",
      header: "Por chamada",
      align: "end",
      getSortValue: (r) => (r.chamadas > 0 ? r.custo / r.chamadas : 0),
      cell: (r) => <span className="tabular-nums text-ink-soft">{porChamada(r.custo, r.chamadas)}</span>,
    },
    {
      key: "receita",
      header: "Receita",
      align: "end",
      getSortValue: (r) => r.receita ?? -1,
      cell: (r) => (
        <span className="tabular-nums text-ink-soft">{r.receita != null ? formatCusto(r.receita) : "Não paga"}</span>
      ),
    },
    {
      key: "margem",
      header: "Margem",
      align: "end",
      getSortValue: (r) => r.margem ?? -Infinity,
      cell: (r) =>
        r.margem == null ? (
          <span className="text-ink-muted">-</span>
        ) : (
          <span className={r.margem < 0 ? "tabular-nums font-medium text-negative-strong" : "tabular-nums text-ink"}>
            {formatCusto(r.margem)}
          </span>
        ),
    },
  ];

  const colunasAgente: ColumnDef<UsoAgenteRow>[] = [
    {
      key: "agente",
      header: "Agente",
      getSortValue: (r) => agentKeyLabel(r.agentKey),
      cell: (r) => <span className="font-medium text-ink">{agentKeyLabel(r.agentKey)}</span>,
    },
    {
      key: "chamadas",
      header: "Chamadas",
      align: "end",
      getSortValue: (r) => r.chamadas,
      cell: (r) => <span className="tabular-nums text-ink-soft">{formatNumberCompact(r.chamadas)}</span>,
    },
    {
      key: "tokens",
      header: "Tokens",
      align: "end",
      getSortValue: (r) => r.tokensTotal,
      cell: (r) => <span className="tabular-nums text-ink-soft">{formatNumberCompact(r.tokensTotal)}</span>,
    },
    {
      key: "custo",
      header: "Custo",
      align: "end",
      getSortValue: (r) => r.custo,
      cell: (r) => <span className="tabular-nums text-ink">{formatCusto(r.custo)}</span>,
    },
    {
      key: "porChamada",
      header: "Por chamada",
      align: "end",
      getSortValue: (r) => (r.chamadas > 0 ? r.custo / r.chamadas : 0),
      cell: (r) => <span className="tabular-nums text-ink-soft">{porChamada(r.custo, r.chamadas)}</span>,
    },
  ];

  const colunasChamada: ColumnDef<Requisicao>[] = [
    {
      key: "quando",
      header: "Quando",
      getSortValue: (r) => r.quando,
      cell: (r) => <span className="text-ink-soft">{quandoRelativo(r.quando)}</span>,
    },
    {
      key: "empresa",
      header: "Empresa",
      getSortValue: (r) => r.empresaNome,
      cell: (r) => <span className="text-ink">{r.empresaNome}</span>,
    },
    {
      key: "agente",
      header: "Agente",
      getSortValue: (r) => agentKeyLabel(r.agentKey),
      cell: (r) => <span className="text-ink-soft">{agentKeyLabel(r.agentKey)}</span>,
    },
    {
      key: "modelo",
      header: "Modelo",
      getSortValue: (r) => r.model ?? "",
      cell: (r) => <span className="font-mono text-xs text-ink-soft">{r.model ?? "-"}</span>,
    },
    {
      key: "tokens",
      header: "Entrada · saída",
      align: "end",
      getSortValue: (r) => r.tokensInput + r.tokensOutput,
      cell: (r) => (
        <span className="tabular-nums text-ink-soft">
          {formatNumberCompact(r.tokensInput)} · {formatNumberCompact(r.tokensOutput)}
        </span>
      ),
    },
    {
      key: "custo",
      header: "Custo",
      align: "end",
      getSortValue: (r) => r.custo,
      cell: (r) => <span className="tabular-nums text-ink">{formatCusto(r.custo)}</span>,
    },
  ];

  return (
    <PilarPage title="Custos de IA">
      <p className="-mt-2 flex items-center gap-1.5 text-sm text-ink-soft">
        Mês corrente, em reais.
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="text-ink-muted hover:text-ink" aria-label="Como calculamos">
              <Info size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            Custo vem do preço do provedor gravado em cada chamada (USD), convertido a R$
            {USD_BRL_REFERENCIA.toFixed(2).replace(".", ",")}. Receita é o preço de tabela do plano pago mais os pacotes
            de tokens pagos no mês. Empresa convidada não gera receita.
          </TooltipContent>
        </Tooltip>
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard icon={Coins} label="Custo" value={t?.custo ?? 0} loading={query.isLoading} />
        <KPICard
          icon={Zap}
          label="Chamadas"
          value={formatNumberCompact(t?.chamadas ?? 0)}
          subtitle={t && t.chamadas > 0 ? `${porChamada(t.custo, t.chamadas)} por chamada` : undefined}
          loading={query.isLoading}
        />
        <KPICard icon={Receipt} label="Receita estimada" value={t?.receita ?? 0} loading={query.isLoading} />
        <KPICard
          icon={TrendingUp}
          label="Margem"
          value={margem}
          tone={margem < 0 ? "danger" : "positive"}
          subtitle={t && t.anomalias > 0 ? `${t.anomalias} com gasto alto hoje` : undefined}
          subtitleTone={t && t.anomalias > 0 ? "danger" : "muted"}
          loading={query.isLoading}
        />
      </div>

      <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)}>
        <ViewSwitcher options={ABAS_CUSTOS} value={aba} onChange={setAba} ariaLabel="Agrupar custos por" />
        <TabsContent value="empresas" className="mt-4">
          <DataTable
            columns={colunasEmpresa}
            data={toDataSourceResult<UsoEmpresaRow>({
              data: query.data?.porEmpresa ?? [],
              isLoading: query.isLoading,
              error: query.error,
            })}
            rowKey={(r) => r.empresaId}
            onRowClick={(r) => navigate(`/ultra-admin/empresas/${r.empresaId}`)}
            defaultSortKey="custo"
            defaultSortDir="desc"
            minWidth="860px"
            emptyMessage="Nenhuma chamada de IA neste mês."
            errorTitle="Não foi possível carregar o uso por empresa"
          />
        </TabsContent>
        <TabsContent value="agentes" className="mt-4">
          <DataTable
            columns={colunasAgente}
            data={toDataSourceResult<UsoAgenteRow>({
              data: query.data?.porAgente ?? [],
              isLoading: query.isLoading,
              error: query.error,
            })}
            rowKey={(r) => r.agentKey}
            defaultSortKey="custo"
            defaultSortDir="desc"
            emptyMessage="Nenhuma chamada de IA neste mês."
            errorTitle="Não foi possível carregar o uso por agente"
          />
        </TabsContent>
        <TabsContent value="chamadas" className="mt-4">
          <DataTable
            columns={colunasChamada}
            data={toDataSourceResult<Requisicao>({
              data: requisicoesQ.data ?? [],
              isLoading: requisicoesQ.isLoading,
              error: requisicoesQ.error,
            })}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/ultra-admin/empresas/${r.empresaId}`)}
            defaultSortKey="quando"
            defaultSortDir="desc"
            minWidth="860px"
            emptyMessage="Nenhuma chamada registrada ainda."
            errorTitle="Não foi possível carregar as chamadas"
          />
        </TabsContent>
      </Tabs>
    </PilarPage>
  );
}

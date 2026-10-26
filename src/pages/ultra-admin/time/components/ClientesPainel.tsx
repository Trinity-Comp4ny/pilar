import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, HeartHandshake, MessageSquare, ShieldCheck } from "lucide-react";
import { KPICard } from "@/components/KPICard";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toDataSourceResult } from "@/types/dataSource";
import { FiltroChips, type OpcaoChip } from "../../components/FiltroChips";
import { quandoRelativo } from "../../lib";
import { useSaudeEmpresas } from "../hooks";
import { tendenciaNota, type Decisao } from "../lib";
import type { SaudeEmpresa } from "../api";
import { ListaDecisoes } from "./ListaDecisoes";

type Filtro = "todas" | "risco" | "atencao" | "saudavel";

/** Ficha Clientes (SPEC 126): nota de saúde de cada escritório e quem pede contato. */
export function ClientesPainel({ decisoes }: { decisoes: Decisao[] }) {
  const navigate = useNavigate();
  const q = useSaudeEmpresas();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const linhas = useMemo(() => q.data ?? [], [q.data]);

  const conta = (f: Exclude<Filtro, "todas">) => linhas.filter((l) => l.faixa === f).length;
  const feedbackAberto = linhas.reduce((s, l) => s + l.feedback_aberto, 0);
  const visiveis = filtro === "todas" ? linhas : linhas.filter((l) => l.faixa === filtro);

  const opcoes: OpcaoChip<Filtro>[] = [
    { value: "todas", label: "Todas", count: linhas.length },
    { value: "risco", label: "Em risco", count: conta("risco") },
    { value: "atencao", label: "Atenção", count: conta("atencao") },
    { value: "saudavel", label: "Saudáveis", count: conta("saudavel") },
  ];

  const colunas: ColumnDef<SaudeEmpresa>[] = [
    {
      key: "empresa",
      header: "Escritório",
      getSortValue: (l) => l.empresa_nome,
      cell: (l) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{l.empresa_nome}</p>
          <StatusBadge domain="empresa_situacao" status={l.situacao_cobranca} className="mt-0.5" />
        </div>
      ),
    },
    {
      key: "nota",
      header: "Saúde",
      getSortValue: (l) => l.nota,
      cell: (l) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="w-7 text-right text-sm font-medium tabular-nums text-ink">{l.nota}</span>
            <StatusBadge domain="saude_cliente" status={l.faixa} />
          </div>
          <Tendencia nota={l.nota} nota7d={l.nota_7d} />
        </div>
      ),
    },
    {
      key: "acesso",
      header: "Último acesso",
      getSortValue: (l) => l.ultimo_acesso ?? "",
      cell: (l) => <span className="text-ink-soft">{quandoRelativo(l.ultimo_acesso) ?? "Ninguém entrou"}</span>,
    },
    {
      key: "semanas",
      header: "Semanas com uso",
      align: "end",
      getSortValue: (l) => l.semanas_ativas,
      cell: (l) => <span className="tabular-nums text-ink-soft">{l.semanas_ativas} de 4</span>,
    },
    {
      key: "projetos",
      header: "Projetos ativos",
      align: "end",
      getSortValue: (l) => l.projetos_ativos,
      cell: (l) => <span className="tabular-nums text-ink-soft">{l.projetos_ativos}</span>,
    },
    {
      key: "usuarios",
      header: "Usuários ativos",
      align: "end",
      getSortValue: (l) => l.usuarios_ativos_14d,
      cell: (l) => (
        <span className="tabular-nums text-ink-soft">
          {l.usuarios_ativos_14d} de {l.usuarios}
        </span>
      ),
    },
    {
      key: "feedback",
      header: "Feedback aberto",
      align: "end",
      getSortValue: (l) => l.feedback_aberto,
      cell: (l) => (
        <span
          className={
            l.feedback_aberto > 0 ? "font-medium tabular-nums text-warning-strong" : "tabular-nums text-ink-muted"
          }
        >
          {l.feedback_aberto}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          icon={HeartHandshake}
          label="Escritórios acompanhados"
          value={`${linhas.length}`}
          loading={q.isLoading}
        />
        <KPICard
          icon={AlertTriangle}
          label="Em risco"
          value={`${conta("risco")}`}
          tone={conta("risco") > 0 ? "danger" : "neutral"}
          subtitle={`${conta("atencao")} ${conta("atencao") === 1 ? "pede" : "pedem"} atenção`}
          loading={q.isLoading}
          onClick={() => setFiltro("risco")}
        />
        <KPICard
          icon={ShieldCheck}
          label="Saudáveis"
          value={`${conta("saudavel")}`}
          subtitle="nota 70 ou mais"
          loading={q.isLoading}
          onClick={() => setFiltro("saudavel")}
        />
        <KPICard
          icon={MessageSquare}
          label="Feedback sem resposta"
          value={`${feedbackAberto}`}
          subtitle="há mais de 24 h"
          tone={feedbackAberto > 0 ? "warning" : "neutral"}
          loading={q.isLoading}
          onClick={() => navigate("/ultra-admin/feedback")}
        />
      </div>

      <Card className="border border-black/5">
        <CardHeader className="pb-1">
          <CardTitle className="text-base">Pede contato</CardTitle>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <ListaDecisoes
              decisoes={decisoes}
              vazio="Todo escritório entrou na última semana e nenhum feedback espera resposta."
            />
          )}
        </CardContent>
      </Card>

      <FiltroChips ariaLabel="Filtrar por saúde" opcoes={opcoes} value={filtro} onChange={setFiltro} />

      <DataTable
        columns={colunas}
        data={toDataSourceResult<SaudeEmpresa>({ data: visiveis, isLoading: q.isLoading, error: q.error })}
        rowKey={(l) => l.empresa_id}
        onRowClick={(l) => navigate(`/ultra-admin/empresas/${l.empresa_id}`)}
        defaultSortKey="nota"
        defaultSortDir="asc"
        minWidth="820px"
        errorTitle="Não foi possível carregar a saúde dos escritórios"
        emptyState={
          <EmptyState
            icon={HeartHandshake}
            title={filtro === "todas" ? "Nenhum escritório cliente ainda" : "Nenhum escritório nesta faixa"}
            description={
              filtro === "todas" ? "Quando a primeira empresa se cadastrar, a nota de saúde aparece aqui." : undefined
            }
          />
        }
      />

      <p className="text-xs text-ink-muted">
        Nota de 0 a 100: último acesso (35), semanas com uso nas últimas 4 (30), projetos ativos (20) e usuários ativos
        em 14 dias (15). Feedback sem resposta tira 10; pagamento em atraso, 20.
      </p>
    </>
  );
}

function Tendencia({ nota, nota7d }: { nota: number; nota7d: number | null }) {
  const t = tendenciaNota(nota, nota7d);
  if (!t) return null;
  return (
    <p className={`pl-9 text-xs tabular-nums ${t.caiu ? "text-danger-mid" : "text-positive-strong"}`}>{t.texto}</p>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertTriangle,
  Users,
  CalendarClock,
  ChevronRight,
  Plus,
  BarChart3,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
  startOfQuarter,
  endOfQuarter,
  format,
  parseISO,
  isValid,
  isSameDay,
} from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, CalendarIcon } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";

const DashboardFinanceChart = lazy(() => import("@/components/charts/DashboardFinanceChart"));
import {
  useDashboardData,
  type DashboardProjeto,
  type DashboardVencimento,
  type DashboardAlerta,
  type LeadsPipeline,
} from "@/hooks/useDashboardData";
import { useFinanceChartData } from "@/hooks/useFinanceChartData";
import { useAuth } from "@/contexts/AuthContext";
import { PROJECT_STATUS_CONFIG, PROJECT_PRIORITY_CONFIG, type ProjectStatus, type ProjectPriority } from "@/constants";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import { CalendarioPreview } from "@/pages/projetos/components/CalendarioPreview";

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

function KPICard({
  title,
  value,
  cardBg,
  titleColor,
  valueColor,
  subtitleColor,
  variacao,
  subtitle,
  onClick,
}: {
  title: string;
  value: string;
  cardBg: string;
  titleColor: string;
  valueColor: string;
  subtitleColor: string;
  variacao?: number;
  subtitle?: string;
  onClick?: () => void;
}) {
  const variacaoNode =
    variacao !== undefined && variacao !== 0 ? (
      <span className={`flex items-center gap-0.5 ${variacao > 0 ? "text-success-mid" : "text-danger-mid"}`}>
        {variacao > 0 ? <TrendingUp size={12} className="mr-0.5" /> : <TrendingDown size={12} className="mr-0.5" />}
        {Math.abs(variacao).toFixed(1)}% vs período anterior
      </span>
    ) : null;

  return (
    <Card
      className={cn(
        "vrz-card w-full",
        cardBg,
        onClick &&
          "cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm font-medium ${titleColor}`}>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
        <p className={`text-xs mt-1 flex items-center gap-1 ${subtitleColor}`}>{variacaoNode ?? subtitle}</p>
      </CardContent>
    </Card>
  );
}

function ProjectRow({ project, onClick }: { project: DashboardProjeto; onClick: () => void }) {
  const statusConfig = PROJECT_STATUS_CONFIG[project.status as ProjectStatus];
  const priorityConfig = PROJECT_PRIORITY_CONFIG[project.prioridade as ProjectPriority];
  const isAtrasado = project.statusData === "em_atraso" || project.progressoPrazo > 100;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer group border-l-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        priorityConfig?.borderColor || "border-l-transparent"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-ink-soft font-semibold text-sm shrink-0">
        {project.nome.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-ink truncate">{project.nome}</h4>
          <Badge className={`text-[10px] px-1.5 py-0 h-4 ${statusConfig?.color || "bg-muted text-ink-soft"}`}>
            {project.status}
          </Badge>
          {priorityConfig && (
            <span
              className={`text-[10px] px-1.5 py-0 h-4 rounded-full font-medium inline-flex items-center ${priorityConfig.bgColor} ${priorityConfig.color}`}
            >
              {priorityConfig.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-ink-disabled">{project.cliente}</span>
          {project.dataPrevisao && (
            <span
              className={`text-xs flex items-center gap-0.5 ${isAtrasado ? "text-chart-danger" : "text-ink-disabled"}`}
            >
              <Clock size={10} />
              {new Date(project.dataPrevisao).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            </span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0 hidden sm:block">
        <div className="text-sm font-medium">
          {project.valorContrato > 0 ? fmtCompact.format(project.valorContrato) : "—"}
        </div>
        {project.dataInicio && project.dataPrevisao && (
          <div className="w-16 mt-1">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isAtrasado ? "bg-chart-danger" : project.progressoPrazo > 75 ? "bg-chart-warning" : "bg-status-done"}`}
                style={{ width: `${Math.min(project.progressoPrazo, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
      <ChevronRight size={14} className="text-ink-disabled group-hover:text-muted-foreground shrink-0" />
    </div>
  );
}

function VencimentoRow({ item }: { item: DashboardVencimento }) {
  const isReceita = item.tipo === "receita";
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div
        className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isReceita ? "bg-positive/10" : "bg-negative/10"}`}
      >
        {isReceita ? (
          <ArrowUpRight size={14} className="text-positive" />
        ) : (
          <ArrowDownRight size={14} className="text-negative" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-soft truncate">{item.entidade || item.descricao}</p>
        <p className="text-[11px] text-ink-disabled truncate">{item.projeto || item.descricao}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-semibold ${isReceita ? "text-positive" : "text-negative"}`}>
          {isReceita ? "+" : "-"}
          {fmt.format(item.valor)}
        </p>
        <p className="text-[11px] text-ink-disabled">
          {item.diasRestantes === 0 ? "Hoje" : item.diasRestantes === 1 ? "Amanhã" : `${item.diasRestantes}d`}
        </p>
      </div>
    </div>
  );
}

function AlertaRow({ alerta }: { alerta: DashboardAlerta }) {
  const sevConfig: Record<string, { bg: string; icon: string }> = {
    critical: { bg: "bg-danger-soft border-danger-mid-border", icon: "text-chart-danger" },
    high: { bg: "bg-attention-soft border-attention-mid-border", icon: "text-status-paused" },
    medium: { bg: "bg-warning-soft border-warning-mid-border", icon: "text-warning-mid" },
    low: { bg: "bg-info-soft border-info-mid-border", icon: "text-chart-info" },
  };
  const config = sevConfig[alerta.severidade] || sevConfig.low;

  return (
    <div className={`flex items-start gap-2 p-2.5 rounded-lg border ${config.bg}`}>
      <AlertTriangle size={14} className={`mt-0.5 shrink-0 ${config.icon}`} />
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-soft">{alerta.titulo}</p>
        <p className="text-[11px] text-muted-foreground truncate">{alerta.mensagem}</p>
      </div>
    </div>
  );
}

const PIPELINE_COLORS: Record<string, string> = {
  Novo: "bg-pipeline-novo",
  "Em contato": "bg-pipeline-contato",
  Proposta: "bg-pipeline-proposta",
  Negociação: "bg-pipeline-negociacao",
  Ganho: "bg-status-done",
  Perdido: "bg-pipeline-perdido",
};

function LeadsFunnel({ pipeline, total }: { pipeline: LeadsPipeline[]; total: number }) {
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-ink-disabled">
        <Users size={24} className="mb-2" />
        <p className="text-sm">Nenhum lead cadastrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pipeline.map((step) => {
        const pct = total > 0 ? (step.count / total) * 100 : 0;
        return (
          <div key={step.status} className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-20 shrink-0 truncate">{step.status}</span>
            <div className="flex-1 h-5 bg-muted rounded overflow-hidden relative">
              <div
                className={`h-full rounded transition-all ${PIPELINE_COLORS[step.status] || "bg-pipeline-perdido"}`}
                style={{ width: `${Math.max(pct, 4)}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-ink-soft mix-blend-darken">
                {step.count}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 w-full animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-3 w-20 mb-4" />
              <Skeleton className="h-6 w-28 mb-2" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-[350px] lg:col-span-2 rounded-xl" />
        <Skeleton className="h-[350px] rounded-xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-[300px] lg:col-span-2 rounded-xl" />
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    </div>
  );
}

type DashPreset = "this-month" | "last-month" | "this-quarter" | "this-year" | "custom";

function rangeForDashPreset(preset: DashPreset): { from: Date; to: Date } | null {
  const now = new Date();
  if (preset === "this-month") return { from: startOfMonth(now), to: endOfMonth(now) };
  if (preset === "last-month") {
    const last = subMonths(now, 1);
    return { from: startOfMonth(last), to: endOfMonth(last) };
  }
  if (preset === "this-quarter") return { from: startOfQuarter(now), to: endOfQuarter(now) };
  if (preset === "this-year") return { from: startOfYear(now), to: endOfYear(now) };
  return null;
}

function detectDashPreset(from: Date, to: Date): DashPreset {
  const eq = (k: Exclude<DashPreset, "custom">) => {
    const r = rangeForDashPreset(k);
    return !!r && isSameDay(r.from, from) && isSameDay(r.to, to);
  };
  if (eq("this-month")) return "this-month";
  if (eq("last-month")) return "last-month";
  if (eq("this-quarter")) return "this-quarter";
  if (eq("this-year")) return "this-year";
  return "custom";
}

function parseDateParam(v: string | null): Date | undefined {
  if (!v) return undefined;
  const d = parseISO(v);
  return isValid(d) ? d : undefined;
}

const PERIOD_LABEL: Record<DashPreset, string> = {
  "this-month": "Este Mês",
  "last-month": "Mês Passado",
  "this-quarter": "Este Trimestre",
  "this-year": "Este Ano",
  custom: "Personalizado",
};

export default function Dashboard() {
  usePageTitle("Dashboard");
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();

  const initial = useMemo(() => {
    const now = new Date();
    return {
      from: parseDateParam(searchParams.get("from")) ?? startOfMonth(now),
      to: parseDateParam(searchParams.get("to")) ?? endOfMonth(now),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [dateFrom, setDateFrom] = useState<Date>(initial.from);
  const [dateTo, setDateTo] = useState<Date>(initial.to);

  const preset = useMemo(() => detectDashPreset(dateFrom, dateTo), [dateFrom, dateTo]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set("from", format(dateFrom, "yyyy-MM-dd"));
    params.set("to", format(dateTo, "yyyy-MM-dd"));
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  const handlePresetChange = (value: string) => {
    if (value === "custom") return;
    const range = rangeForDashPreset(value as DashPreset);
    if (range) {
      setDateFrom(range.from);
      setDateTo(range.to);
    }
  };

  const { profile } = useAuth();
  const empresaId = profile?.empresa_id ?? null;

  const { data, isLoading, error, refetch, isFetching } = useDashboardData(dateFrom, dateTo);

  // Intervalo dos últimos 11 meses + mês atual para o gráfico de fluxo
  const chartInicio = useMemo(() => startOfMonth(subMonths(new Date(), 11)), []);
  const chartFim = useMemo(() => new Date(), []);
  const { data: chartDataRpc } = useFinanceChartData(empresaId, chartInicio, chartFim);

  const canFin = can("financeiro", "view");
  const canProj = can("projetos", "view");
  const canProjCreate = can("projetos", "create");
  const canLeads = can("leads", "view");
  const canRel = can("relatorios", "view");

  const periodoLabel =
    preset === "custom" ? `${format(dateFrom, "dd/MM/yyyy")} → ${format(dateTo, "dd/MM/yyyy")}` : PERIOD_LABEL[preset];

  const header = (
    <PageHeader title="Dashboard" description={`Visão geral — ${periodoLabel}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 mr-1">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Select value={preset} onValueChange={handlePresetChange}>
            <SelectTrigger className="w-[160px] h-9 text-sm rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this-month">Este Mês</SelectItem>
              <SelectItem value="last-month">Mês Passado</SelectItem>
              <SelectItem value="this-quarter">Este Trimestre</SelectItem>
              <SelectItem value="this-year">Este Ano</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {preset === "custom" && (
            <div className="flex gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 text-sm rounded-full">
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {format(dateFrom, "dd/MM/yy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} initialFocus />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 text-sm rounded-full">
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {format(dateTo, "dd/MM/yy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
        {canLeads && (
          <Button variant="outline" size="sm" className="text-sm rounded-full" onClick={() => navigate("/leads")}>
            <Users size={14} className="mr-1" /> Leads
          </Button>
        )}
        {canRel && (
          <Button variant="outline" size="sm" className="text-sm rounded-full" onClick={() => navigate("/relatorios")}>
            <BarChart3 size={14} className="mr-1" /> Relatórios
          </Button>
        )}
        {canFin && (
          <Button variant="outline" size="sm" className="text-sm rounded-full" onClick={() => navigate("/financeiro")}>
            <DollarSign size={14} className="mr-1" /> Financeiro
          </Button>
        )}
        {canProjCreate && (
          <Button
            className="rounded-full bg-brand hover:bg-brand/90 text-ink-on-brand transition-colors px-5 py-2.5 text-sm"
            onClick={() => navigate("/projetos")}
          >
            <Plus size={14} className="mr-1" /> Novo Projeto
          </Button>
        )}
      </div>
    </PageHeader>
  );

  if (error) {
    return (
      <PageLayout header={header}>
        <div className="p-6">
          <div
            className="bg-danger-soft border border-danger-mid-border text-danger-mid px-4 py-3 rounded-lg"
            role="alert"
          >
            <strong className="font-bold">Erro ao carregar dados.</strong>
            <span className="block sm:inline ml-1">Verifique sua conexão e tente novamente.</span>
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="rounded-full"
              >
                {isFetching ? "Recarregando…" : "Tentar novamente"}
              </Button>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (isLoading || !data) {
    return (
      <PageLayout header={header}>
        <DashboardSkeleton />
      </PageLayout>
    );
  }

  const { kpis, projetos, proximosVencimentos, leadsPipeline, leadsTotal, alertas, alertasNaoLidos, chartData: chartDataFallback } = data;

  // Usa dados da RPC quando disponível; fallback para a query legada
  const chartData = chartDataRpc && chartDataRpc.length > 0 ? chartDataRpc : chartDataFallback;

  const nothingVisible = !canFin && !canProj && !canLeads;

  if (nothingVisible) {
    return (
      <PageLayout header={header}>
        <div className="flex flex-col items-center justify-center text-center py-20 px-6">
          <div className="p-4 rounded-2xl bg-muted mb-4">
            <AlertTriangle size={32} className="text-ink-disabled" />
          </div>
          <h2 className="text-lg font-semibold text-ink-soft mb-1">Sem módulos disponíveis</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Seu usuário ainda não tem acesso a módulos do dashboard. Peça ao administrador da empresa para liberar
            permissões.
          </p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout header={header}>
      <div className="space-y-6 w-full max-w-none">
        {(canFin || canProj || canLeads) && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {canFin && (
              <>
                <KPICard
                  title="Receita do período"
                  value={fmt.format(kpis.receitaMes)}
                  cardBg="bg-success-soft border-success-soft-border"
                  titleColor="text-success-strong"
                  valueColor="text-success-mid"
                  subtitleColor="text-success"
                  variacao={kpis.receitaVariacao}
                />
                <KPICard
                  title="Despesa do período"
                  value={fmt.format(kpis.despesaMes)}
                  cardBg="bg-danger-soft border-danger-soft-border"
                  titleColor="text-danger-strong"
                  valueColor="text-danger-mid"
                  subtitleColor="text-danger"
                  variacao={kpis.despesaVariacao}
                />
                <KPICard
                  title="Saldo do período"
                  value={fmt.format(kpis.saldoMes)}
                  cardBg={
                    kpis.saldoMes >= 0
                      ? "bg-info-soft border-info-soft-border"
                      : "bg-danger-soft border-danger-soft-border"
                  }
                  titleColor={kpis.saldoMes >= 0 ? "text-info-strong" : "text-danger-strong"}
                  valueColor={kpis.saldoMes >= 0 ? "text-info-mid" : "text-danger-mid"}
                  subtitleColor={kpis.saldoMes >= 0 ? "text-info" : "text-danger"}
                  subtitle="receitas − despesas"
                />
                <KPICard
                  title="A Receber"
                  value={fmt.format(kpis.aReceber)}
                  cardBg="bg-warning-soft border-warning-soft-border"
                  titleColor="text-warning-strong"
                  valueColor="text-warning-mid"
                  subtitleColor="text-warning"
                  subtitle="total pendente"
                />
              </>
            )}
            {canProj && (
              <KPICard
                title="Projetos Ativos"
                value={String(kpis.projetosAtivos)}
                cardBg="bg-attention-soft border-attention-soft-border"
                titleColor="text-attention-strong"
                valueColor="text-attention-mid"
                subtitleColor="text-attention"
                subtitle="em andamento"
                onClick={() => navigate("/projetos")}
              />
            )}
            {canLeads && (
              <KPICard
                title="Leads"
                value={String(leadsTotal)}
                cardBg="bg-highlight-soft border-highlight-soft-border"
                titleColor="text-highlight-strong"
                valueColor="text-highlight-mid"
                subtitleColor="text-highlight"
                subtitle="no pipeline"
                onClick={() => navigate("/leads")}
              />
            )}
          </div>
        )}

        {/* Gráfico Financeiro */}
        {canFin && (
          <div className="grid grid-cols-1 gap-6">
            <Card className="rounded-2xl border border-black/5 bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-medium tracking-tight flex items-center gap-2">
                    <BarChart3 size={18} className="text-muted-foreground" />
                    Fluxo Financeiro
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={() => navigate("/financeiro")}
                  >
                    Ver detalhes <ChevronRight size={14} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full">
                  <Suspense fallback={<Skeleton className="h-full w-full" />}>
                    <DashboardFinanceChart data={chartData} />
                  </Suspense>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Projetos + Alertas */}
        <div className={cn("grid grid-cols-1 gap-6", canProj && "lg:grid-cols-3")}>
          {canProj && (
            <Card className="rounded-2xl border border-black/5 bg-white lg:col-span-2">
              <CardHeader className="pb-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-medium tracking-tight flex items-center gap-2">
                    <Briefcase size={18} className="text-muted-foreground" />
                    Projetos
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={() => navigate("/projetos")}
                  >
                    Ver todos <ChevronRight size={14} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {projetos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-ink-disabled">
                    <Briefcase size={28} className="mb-2" />
                    <p className="text-sm">Nenhum projeto ativo</p>
                    {canProjCreate && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 text-xs"
                        onClick={() => navigate("/projetos")}
                      >
                        Criar Projeto
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {projetos.map((p) => (
                      <ProjectRow key={p.id} project={p} onClick={() => navigate(`/projetos/${p.id}`)} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Alertas */}
          <Card className="rounded-2xl border border-black/5 bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-medium tracking-tight flex items-center gap-2">
                  <AlertTriangle size={18} className="text-muted-foreground" />
                  Alertas
                  {alertasNaoLidos > 0 && (
                    <span className="bg-chart-danger text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {alertasNaoLidos}
                    </span>
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {alertas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-ink-disabled">
                  <AlertTriangle size={24} className="mb-2" />
                  <p className="text-sm">Tudo tranquilo por aqui</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alertas.map((a) => (
                    <AlertaRow key={a.id} alerta={a} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Calendário de prazos */}
        {canProj && <CalendarioPreview />}

        {/* Próximos Vencimentos + Pipeline de Leads */}
        {(canFin || canLeads) && (
          <div className={cn("grid grid-cols-1 gap-6", canFin && canLeads && "lg:grid-cols-3")}>
            {canFin && (
              <Card className={cn("rounded-2xl border border-black/5 bg-white", canFin && canLeads && "lg:col-span-2")}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-medium tracking-tight flex items-center gap-2">
                      <CalendarClock size={18} className="text-muted-foreground" />
                      Próximos Vencimentos
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() => navigate("/financeiro")}
                    >
                      Ver todos <ChevronRight size={14} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {proximosVencimentos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-ink-disabled">
                      <CalendarClock size={24} className="mb-2" />
                      <p className="text-sm">Sem vencimentos próximos</p>
                    </div>
                  ) : (
                    <div>
                      {proximosVencimentos.map((v) => (
                        <VencimentoRow key={v.id} item={v} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {canLeads && (
              <Card className="rounded-2xl border border-black/5 bg-white">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-medium tracking-tight flex items-center gap-2">
                      <Target size={18} className="text-muted-foreground" />
                      Pipeline de Leads
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() => navigate("/leads")}
                    >
                      Ver todos <ChevronRight size={14} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <LeadsFunnel pipeline={leadsPipeline} total={leadsTotal} />
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
}

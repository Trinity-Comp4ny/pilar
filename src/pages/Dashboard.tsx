import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  Briefcase,
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
import { useDashboardData } from "@/hooks/useDashboardData";
import { useFinanceChartData } from "@/hooks/useFinanceChartData";
import { useFinanceChartFallback } from "@/hooks/useFinanceChartFallback";
import { useAuth } from "@/contexts/AuthContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import { CalendarioPreview } from "@/pages/projetos/components/CalendarioPreview";
import { fmt } from "@/pages/dashboard/components/format";
import { KPICard } from "@/pages/dashboard/components/KPICard";
import { ProjectRow } from "@/pages/dashboard/components/ProjectRow";
import { VencimentoRow } from "@/pages/dashboard/components/VencimentoRow";
import { AlertaRow } from "@/pages/dashboard/components/AlertaRow";
import { LeadsFunnel } from "@/pages/dashboard/components/LeadsFunnel";
import { DashboardSkeleton } from "@/pages/dashboard/components/DashboardSkeleton";

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

// Separa falha de acesso (RLS/permissão/sessão) de falha de rede para não culpar sempre a conexão.
function describeDashboardError(error: unknown): { title: string; detail: string } {
  const e = error as { code?: string; message?: string } | null;
  const code = e?.code ?? "";
  const msg = (e?.message ?? "").toLowerCase();
  const isAccessError =
    code === "42501" || // insufficient_privilege (Postgres)
    code === "PGRST301" || // JWT ausente/expirado (PostgREST)
    msg.includes("permission") ||
    msg.includes("row-level security") ||
    msg.includes("not authorized") ||
    msg.includes("jwt");
  if (isAccessError) {
    return {
      title: "Sem acesso a estes dados.",
      detail: "Sua sessão pode ter expirado ou faltam permissões. Recarregue ou peça acesso ao administrador.",
    };
  }
  return {
    title: "Erro ao carregar dados.",
    detail: "Verifique sua conexão e tente novamente.",
  };
}

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

  // Intervalo dos últimos 11 meses + mês atual para o gráfico de fluxo.
  // Ancorado em todayKey (dia local) para não congelar o "hoje" da montagem em sessões longas.
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const chartInicio = useMemo(() => startOfMonth(subMonths(parseISO(todayKey), 11)), [todayKey]);
  const chartFim = useMemo(() => parseISO(todayKey), [todayKey]);
  const { data: chartDataRpc, isError: chartRpcError } = useFinanceChartData(empresaId, chartInicio, chartFim);
  // Fallback só dispara quando a RPC agregada falha (evita full-scan no caminho feliz).
  const { data: chartDataFallback, isError: chartFallbackError } = useFinanceChartFallback(
    empresaId,
    chartInicio,
    chartRpcError
  );
  // Sem dado utilizável de nenhuma fonte: RPC falhou e o fallback também (ou ainda não retornou).
  const chartFailed = chartRpcError && chartFallbackError;

  const canFin = can("financeiro", "view");
  const canProj = can("projetos", "view");
  const canProjCreate = can("projetos", "create");
  const canLeads = can("leads", "view");
  const canRel = can("relatorios", "view");

  // Drill-down dos KPIs financeiros: leva ao Financeiro já filtrado pelo período do dashboard.
  const goFinanceiro = () =>
    navigate(`/financeiro?from=${format(dateFrom, "yyyy-MM-dd")}&to=${format(dateTo, "yyyy-MM-dd")}`);

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
    const { title: errorTitle, detail: errorDetail } = describeDashboardError(error);
    return (
      <PageLayout header={header}>
        <div className="p-6">
          <div
            className="bg-danger-soft border border-danger-mid-border text-danger-mid px-4 py-3 rounded-lg"
            role="alert"
          >
            <strong className="font-bold">{errorTitle}</strong>
            <span className="block sm:inline ml-1">{errorDetail}</span>
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

  const { kpis, projetos, proximosVencimentos, leadsPipeline, leadsTotal, alertas, alertasNaoLidos } = data;

  // Usa dados da RPC quando disponível; fallback só carrega quando a RPC falha.
  const chartData = chartDataRpc && chartDataRpc.length > 0 ? chartDataRpc : chartDataFallback ?? [];

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
                  novo={kpis.receitaNovo}
                  subtitle="recebido + previsto"
                  onClick={goFinanceiro}
                />
                <KPICard
                  title="Despesa do período"
                  value={fmt.format(kpis.despesaMes)}
                  cardBg="bg-danger-soft border-danger-soft-border"
                  titleColor="text-danger-strong"
                  valueColor="text-danger-mid"
                  subtitleColor="text-danger"
                  variacao={kpis.despesaVariacao}
                  invertVariacao
                  novo={kpis.despesaNovo}
                  subtitle="pago + previsto"
                  onClick={goFinanceiro}
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
                  onClick={goFinanceiro}
                />
                <KPICard
                  title="A Receber"
                  value={fmt.format(kpis.aReceber)}
                  cardBg="bg-warning-soft border-warning-soft-border"
                  titleColor="text-warning-strong"
                  valueColor="text-warning-mid"
                  subtitleColor="text-warning"
                  subtitle="vence no período"
                  onClick={goFinanceiro}
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
                  {chartFailed ? (
                    <div
                      className="flex h-full flex-col items-center justify-center text-center text-ink-disabled"
                      role="alert"
                    >
                      <AlertTriangle size={24} className="mb-2 text-warning-mid" />
                      <p className="text-sm text-ink-soft">Não foi possível carregar o fluxo financeiro.</p>
                      <p className="text-xs mt-0.5">Atualize a página para tentar de novo.</p>
                    </div>
                  ) : (
                    <Suspense fallback={<Skeleton className="h-full w-full" />}>
                      <DashboardFinanceChart data={chartData} />
                    </Suspense>
                  )}
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

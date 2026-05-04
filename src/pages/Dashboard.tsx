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
  FileText,
  BarChart3,
  Target,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ResponsiveContainer, Area, XAxis, YAxis, CartesianGrid, Tooltip, ComposedChart, Legend, Line } from "recharts";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { CustomTooltip } from "./financeiro/components/CustomTooltip";
import {
  useDashboardData,
  type DashboardProjeto,
  type DashboardVencimento,
  type DashboardAlerta,
  type LeadsPipeline,
} from "@/hooks/useDashboardData";
import { PROJECT_STATUS_CONFIG, PROJECT_PRIORITY_CONFIG, type ProjectStatus, type ProjectPriority } from "@/constants";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";

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
      <span className={`flex items-center gap-0.5 ${variacao > 0 ? "text-green-600" : "text-red-600"}`}>
        {variacao > 0 ? <TrendingUp size={12} className="mr-0.5" /> : <TrendingDown size={12} className="mr-0.5" />}
        {Math.abs(variacao).toFixed(1)}% vs mês anterior
      </span>
    ) : null;

  return (
    <Card
      className={`vrz-card w-full ${cardBg} ${onClick ? "cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5" : ""}`}
      onClick={onClick}
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
      className={`flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group border-l-[3px] ${priorityConfig?.borderColor || "border-l-transparent"}`}
      onClick={onClick}
    >
      <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 font-semibold text-sm shrink-0">
        {project.nome.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-gray-900 truncate">{project.nome}</h4>
          <Badge className={`text-[10px] px-1.5 py-0 h-4 ${statusConfig?.color || "bg-gray-100 text-gray-700"}`}>
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
          <span className="text-xs text-gray-400">{project.cliente}</span>
          {project.dataPrevisao && (
            <span className={`text-xs flex items-center gap-0.5 ${isAtrasado ? "text-red-500" : "text-gray-400"}`}>
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
            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isAtrasado ? "bg-chart-danger" : project.progressoPrazo > 75 ? "bg-chart-warning" : "bg-status-done"}`}
                style={{ width: `${Math.min(project.progressoPrazo, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
      <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 shrink-0" />
    </div>
  );
}

function VencimentoRow({ item }: { item: DashboardVencimento }) {
  const isReceita = item.tipo === "receita";
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
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
        <p className="text-sm font-medium text-gray-800 truncate">{item.entidade || item.descricao}</p>
        <p className="text-[11px] text-gray-400 truncate">{item.projeto || item.descricao}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-semibold ${isReceita ? "text-positive" : "text-negative"}`}>
          {isReceita ? "+" : "-"}
          {fmt.format(item.valor)}
        </p>
        <p className="text-[11px] text-gray-400">
          {item.diasRestantes === 0 ? "Hoje" : item.diasRestantes === 1 ? "Amanhã" : `${item.diasRestantes}d`}
        </p>
      </div>
    </div>
  );
}

function AlertaRow({ alerta }: { alerta: DashboardAlerta }) {
  const sevConfig: Record<string, { bg: string; icon: string }> = {
    critical: { bg: "bg-red-50 border-red-200", icon: "text-red-500" },
    high: { bg: "bg-orange-50 border-orange-200", icon: "text-orange-500" },
    medium: { bg: "bg-yellow-50 border-yellow-200", icon: "text-yellow-600" },
    low: { bg: "bg-blue-50 border-blue-200", icon: "text-blue-500" },
  };
  const config = sevConfig[alerta.severidade] || sevConfig.low;

  return (
    <div className={`flex items-start gap-2 p-2.5 rounded-lg border ${config.bg}`}>
      <AlertTriangle size={14} className={`mt-0.5 shrink-0 ${config.icon}`} />
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-800">{alerta.titulo}</p>
        <p className="text-[11px] text-gray-500 truncate">{alerta.mensagem}</p>
      </div>
    </div>
  );
}

const PIPELINE_COLORS: Record<string, string> = {
  Novo: "bg-blue-500",
  "Em contato": "bg-indigo-500",
  Proposta: "bg-purple-500",
  Negociação: "bg-amber-500",
  Ganho: "bg-status-done",
  Perdido: "bg-gray-400",
};

function LeadsFunnel({ pipeline, total }: { pipeline: LeadsPipeline[]; total: number }) {
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-400">
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
            <span className="text-[11px] text-gray-500 w-20 shrink-0 truncate">{step.status}</span>
            <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden relative">
              <div
                className={`h-full rounded transition-all ${PIPELINE_COLORS[step.status] || "bg-gray-400"}`}
                style={{ width: `${Math.max(pct, 4)}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-gray-700 mix-blend-darken">
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

export default function Dashboard() {
  usePageTitle("Dashboard");
  const navigate = useNavigate();
  const { data, isLoading, error } = useDashboardData();
  const { can } = usePermissions();

  const canFin = can("financeiro", "view");
  const canProj = can("projetos", "view");
  const canProjCreate = can("projetos", "create");
  const canLeads = can("leads", "view");
  const canRel = can("relatorios", "view");

  const mesAtual = new Date().toLocaleString("pt-BR", { month: "long" });

  const header = (
    <PageHeader
      title="Dashboard"
      description={`Visão geral — ${mesAtual.charAt(0).toUpperCase() + mesAtual.slice(1)} ${new Date().getFullYear()}`}
    >
      <div className="flex items-center gap-2">
        {canFin && (
          <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate("/financeiro")}>
            <DollarSign size={14} className="mr-1" /> Financeiro
          </Button>
        )}
        {canProjCreate && (
          <Button
            size="sm"
            className="text-xs bg-brand hover:bg-brand/90 text-gray-900"
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
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg" role="alert">
            <strong className="font-bold">Erro ao carregar dados.</strong>
            <span className="block sm:inline ml-1">Verifique sua conexão e tente recarregar a página.</span>
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

  const { kpis, projetos, proximosVencimentos, leadsPipeline, leadsTotal, alertas, alertasNaoLidos, chartData } = data;

  const showMiniKpis = canFin || canProj || canLeads;

  const atalhos = [
    canProjCreate && {
      label: "Novo Projeto",
      icon: Briefcase,
      path: "/projetos",
      color: "hover:border-orange-300 hover:bg-orange-50/50",
    },
    canLeads && {
      label: "Novo Lead",
      icon: Users,
      path: "/leads",
      color: "hover:border-purple-300 hover:bg-purple-50/50",
    },
    canFin && {
      label: "Lançamento",
      icon: DollarSign,
      path: "/financeiro",
      color: "hover:border-positive/30 hover:bg-positive/5",
    },
    canRel && {
      label: "Relatórios",
      icon: FileText,
      path: "/relatorios",
      color: "hover:border-blue-300 hover:bg-blue-50/50",
    },
  ].filter(Boolean) as { label: string; icon: typeof Briefcase; path: string; color: string }[];

  const nothingVisible = !canFin && !canProj && !canLeads && !canRel;

  if (nothingVisible) {
    return (
      <PageLayout header={header}>
        <div className="flex flex-col items-center justify-center text-center py-20 px-6">
          <div className="p-4 rounded-2xl bg-gray-50 mb-4">
            <AlertTriangle size={32} className="text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Sem módulos disponíveis</h2>
          <p className="text-sm text-gray-500 max-w-md">
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
                  title="Receita do Mês"
                  value={fmt.format(kpis.receitaMes)}
                  cardBg="bg-green-50 border-green-100"
                  titleColor="text-green-800"
                  valueColor="text-green-700"
                  subtitleColor="text-green-600"
                  variacao={kpis.receitaVariacao}
                />
                <KPICard
                  title="Despesa do Mês"
                  value={fmt.format(kpis.despesaMes)}
                  cardBg="bg-red-50 border-red-100"
                  titleColor="text-red-800"
                  valueColor="text-red-700"
                  subtitleColor="text-red-600"
                  variacao={kpis.despesaVariacao}
                />
                <KPICard
                  title="Saldo do Mês"
                  value={fmt.format(kpis.saldoMes)}
                  cardBg={kpis.saldoMes >= 0 ? "bg-blue-50 border-blue-100" : "bg-red-50 border-red-100"}
                  titleColor={kpis.saldoMes >= 0 ? "text-blue-800" : "text-red-800"}
                  valueColor={kpis.saldoMes >= 0 ? "text-blue-700" : "text-red-700"}
                  subtitleColor={kpis.saldoMes >= 0 ? "text-blue-600" : "text-red-600"}
                  subtitle="receitas − despesas"
                />
                <KPICard
                  title="A Receber"
                  value={fmt.format(kpis.aReceber)}
                  cardBg="bg-amber-50 border-amber-100"
                  titleColor="text-amber-800"
                  valueColor="text-amber-700"
                  subtitleColor="text-amber-600"
                  subtitle="pendente"
                />
              </>
            )}
            {canProj && (
              <KPICard
                title="Projetos Ativos"
                value={String(kpis.projetosAtivos)}
                cardBg="bg-orange-50 border-orange-100"
                titleColor="text-orange-800"
                valueColor="text-orange-700"
                subtitleColor="text-orange-600"
                subtitle="em andamento"
                onClick={() => navigate("/projetos")}
              />
            )}
            {canLeads && (
              <KPICard
                title="Leads"
                value={String(leadsTotal)}
                cardBg="bg-purple-50 border-purple-100"
                titleColor="text-purple-800"
                valueColor="text-purple-700"
                subtitleColor="text-purple-600"
                subtitle="no pipeline"
                onClick={() => navigate("/leads")}
              />
            )}
          </div>
        )}

        {/* Gráfico Financeiro */}
        {canFin && (
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <BarChart3 size={18} className="text-gray-500" />
                    Fluxo Financeiro
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-gray-500"
                    onClick={() => navigate("/financeiro")}
                  >
                    Ver detalhes <ChevronRight size={14} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gReceitas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-success))" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="hsl(var(--chart-success))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gDespesas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-danger))" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="hsl(var(--chart-danger))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" vertical={false} />
                      <XAxis
                        dataKey="mes"
                        stroke="hsl(var(--chart-neutral))"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="hsl(var(--chart-neutral))"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => fmtCompact.format(v)}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      <Area
                        type="monotone"
                        dataKey="receitas"
                        name="Receitas"
                        stroke="hsl(var(--chart-success))"
                        fill="url(#gReceitas)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="despesas"
                        name="Despesas"
                        stroke="hsl(var(--chart-danger))"
                        fill="url(#gDespesas)"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="saldo"
                        name="Saldo"
                        stroke="hsl(var(--c-indigo-500))"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Projetos + Alertas */}
        <div className={cn("grid grid-cols-1 gap-6", canProj && "lg:grid-cols-3")}>
          {canProj && (
            <Card className="lg:col-span-2">
              <CardHeader className="pb-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Briefcase size={18} className="text-gray-500" />
                    Projetos
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-gray-500"
                    onClick={() => navigate("/projetos")}
                  >
                    Ver todos <ChevronRight size={14} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {projetos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400">
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
                  <div className="divide-y divide-gray-50">
                    {projetos.map((p) => (
                      <ProjectRow key={p.id} project={p} onClick={() => navigate(`/projetos/${p.id}`)} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Alertas */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <AlertTriangle size={18} className="text-gray-500" />
                  Alertas
                  {alertasNaoLidos > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {alertasNaoLidos}
                    </span>
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {alertas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
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

        {/* Próximos Vencimentos + Pipeline de Leads */}
        {(canFin || canLeads) && (
          <div className={cn("grid grid-cols-1 gap-6", canFin && canLeads && "lg:grid-cols-3")}>
            {canFin && (
              <Card className={cn(canFin && canLeads && "lg:col-span-2")}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <CalendarClock size={18} className="text-gray-500" />
                      Próximos Vencimentos
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-gray-500"
                      onClick={() => navigate("/financeiro")}
                    >
                      Ver todos <ChevronRight size={14} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {proximosVencimentos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
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
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <Target size={18} className="text-gray-500" />
                      Pipeline de Leads
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-gray-500"
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

        {/* Atalhos rápidos */}
        {atalhos.length > 0 && (
          <div
            className={cn(
              "grid gap-3",
              atalhos.length === 1 && "grid-cols-1",
              atalhos.length === 2 && "grid-cols-2",
              atalhos.length === 3 && "grid-cols-2 sm:grid-cols-3",
              atalhos.length === 4 && "grid-cols-2 sm:grid-cols-4"
            )}
          >
            {atalhos.map((atalho) => (
              <button
                key={atalho.label}
                onClick={() => navigate(atalho.path)}
                className={`flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-white text-left transition-all shadow-sm hover:shadow-md ${atalho.color}`}
              >
                <atalho.icon size={18} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{atalho.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}

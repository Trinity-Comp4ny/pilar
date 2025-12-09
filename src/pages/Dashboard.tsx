import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign,
  Briefcase,
  UserPlus,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  BarChart3
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ComposedChart,
  Legend
} from "recharts";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { CustomTooltip } from "./financeiro/components/CustomTooltip";
import { useDashboardData } from "@/hooks/useDashboardData";

export default function DashboardNew() {
  const navigate = useNavigate();
  const { data: dashboardData, isLoading, error } = useDashboardData();

  const stats = dashboardData?.stats || {
    receitasTotal: 0,
    despesasTotal: 0,
    receitasMes: 0,
    despesasMes: 0,
    leadsTotal: 0,
    projectsActive: 0
  };

  const chartData = dashboardData?.chartData || [];
  const recentProjects = dashboardData?.recentProjects || [];

  const header = (
    <PageHeader
      title="Dashboard"
      description="Visão geral do seu desempenho hoje"
    >
      {/* <div className="flex items-center gap-2">
        <Button variant="outline" className="text-sm rounded-full" onClick={() => navigate('/projetos')}>
          Projetos
        </Button>
        <Button className="text-sm bg-accent-orange hover:bg-accent-orange/90 text-white rounded-full" onClick={() => navigate('/financeiro')}>
          Novo Lançamento
        </Button>
      </div> */}
    </PageHeader>
  );

  if (isLoading) {
    return (
      <PageLayout header={header}>
        <div className="flex items-center justify-center h-full">
          <p>Carregando dados...</p>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout header={header}>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">Erro ao carregar dados!</strong>
            <span className="block sm:inline"> {error instanceof Error ? error.message : "Erro desconhecido ao conectar com Supabase"}</span>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout header={header}>
      <div className="space-y-6 w-full max-w-none">

        {/* KPI Grid - Padronizado com Financeiro */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {/* Receitas */}
          <Card className="vrz-card w-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-black/60">Receitas</CardTitle>
              <div className="p-2 rounded-full bg-green-100 text-green-600">
                <ArrowUpRight size={18} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.receitasTotal)}
              </div>
              <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                <TrendingUp size={12} />
                +{Number(stats.receitasMes).toFixed(1)}% vs período anterior
              </p>
            </CardContent>
          </Card>

          {/* Despesas */}
          <Card className="vrz-card w-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-black/60">Despesas</CardTitle>
              <div className="p-2 rounded-full bg-red-100 text-red-600">
                <ArrowDownRight size={18} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.despesasTotal)}
              </div>
              <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                <TrendingDown size={12} />
                {stats.despesasMes}% vs período anterior
              </p>
            </CardContent>
          </Card>

          {/* Leads Novos */}
          <Card className="vrz-card w-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-black/60">Total de Leads Novos</CardTitle>
              <div className="p-2 rounded-full bg-blue-100 text-blue-600">
                <UserPlus size={18} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {stats.leadsTotal}
              </div>
              <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                <TrendingUp size={12} />
                Total acumulado
              </p>
            </CardContent>
          </Card>

          {/* Projetos em Andamento */}
          <Card className="vrz-card w-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-black/60">Projetos em Andamento</CardTitle>
              <div className="p-2 rounded-full bg-accent-orange/10 text-accent-orange">
                <Briefcase size={18} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent-orange">
                {stats.projectsActive}
              </div>
              <p className="text-xs text-black/50 mt-1">
                Projetos ativos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de Fluxo Financeiro */}
        <Card className="vrz-card w-full shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 size={20} />
              Fluxo Financeiro
            </CardTitle>
            <CardDescription>Comparativo de Receitas x Despesas nos últimos meses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-success))" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="hsl(var(--chart-success))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-danger))" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="hsl(var(--chart-danger))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="mes"
                    stroke="#888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `R$${value / 1000}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="receitas"
                    name="Receitas"
                    stroke="hsl(var(--chart-success))"
                    fillOpacity={1}
                    fill="url(#colorReceitas)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="despesas"
                    name="Despesas"
                    stroke="hsl(var(--chart-danger))"
                    fillOpacity={1}
                    fill="url(#colorDespesas)"
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Projetos em Andamento & Atalhos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">

          {/* Lista de Projetos */}
          <Card className="lg:col-span-2 vrz-card w-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-medium">Projetos Recentes</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/projetos')}>
                Ver Todos
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentProjects.map((project: any) => (
                  <div key={project.id} className="flex items-center justify-between p-4 rounded-lg bg-gray-50/50 hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 cursor-pointer" onClick={() => navigate('/projetos')}>
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                        {project.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{project.name}</h4>
                        <p className="text-xs text-gray-500">{project.client}</p>
                      </div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-medium text-gray-900">{project.value}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${project.status === 'Concluído' ? 'bg-green-100 text-green-700' :
                        project.status === 'Planejamento' ? 'bg-gray-100 text-gray-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                        {project.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Atalhos e Ajuda */}
          <div className="space-y-6 w-full">
            <Card className="vrz-card w-full bg-gradient-to-br from-gray-900 to-gray-800 text-white border-none">
              <CardContent className="p-6">
                <h3 className="text-lg font-medium mb-2">Precisa de ajuda?</h3>
                <p className="text-gray-300 text-sm mb-6">Nossa equipe de suporte está disponível para auxiliar com qualquer dúvida.</p>
                <Button className="w-full bg-white text-black hover:bg-gray-100 transition-colors border-0">
                  Falar com Suporte
                </Button>
              </CardContent>
            </Card>

            <Card className="vrz-card w-full">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider">Atalhos</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-gray-600 hover:text-[#FF4000] hover:bg-[#FF4000]/5"
                    onClick={() => navigate('/clientes')}
                  >
                    <UserPlus size={16} className="mr-2" /> Adicionar Cliente
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-gray-600 hover:text-[#FF4000] hover:bg-[#FF4000]/5"
                    onClick={() => navigate('/projetos')}
                  >
                    <Briefcase size={16} className="mr-2" /> Novo Projeto
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-gray-600 hover:text-[#FF4000] hover:bg-[#FF4000]/5"
                    onClick={() => navigate('/financeiro')}
                  >
                    <DollarSign size={16} className="mr-2" /> Registrar Despesa
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-gray-600 hover:text-[#FF4000] hover:bg-[#FF4000]/5"
                    onClick={() => navigate('/leads')}
                  >
                    <UserPlus size={16} className="mr-2" /> Novo Lead
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </PageLayout>
  );
}

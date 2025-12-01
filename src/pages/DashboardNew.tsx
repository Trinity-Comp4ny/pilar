import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  DollarSign, 
  Users, 
  Briefcase, 
  UserPlus, 
  ArrowUpRight,
  MoreHorizontal,
  TrendingUp
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { 
  Area, 
  AreaChart, 
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  BarChart,
  Bar
} from "recharts";
import { Button } from "@/components/ui/button";

// Mock data
const financialData = [
  { name: "Jan", value: 2400 },
  { name: "Fev", value: 1398 },
  { name: "Mar", value: 9800 },
  { name: "Abr", value: 3908 },
  { name: "Mai", value: 4800 },
  { name: "Jun", value: 3800 },
  { name: "Jul", value: 4300 },
];

const leadsData = [
  { name: "Seg", value: 12 },
  { name: "Ter", value: 18 },
  { name: "Qua", value: 15 },
  { name: "Qui", value: 25 },
  { name: "Sex", value: 20 },
  { name: "Sab", value: 8 },
  { name: "Dom", value: 5 },
];

const recentProjects = [
  { id: 1, name: "Residencial Alphaville", status: "Em andamento", client: "João Silva", value: "R$ 450k" },
  { id: 2, name: "Reforma Comercial Centro", status: "Planejamento", client: "Empresa ABC", value: "R$ 120k" },
  { id: 3, name: "Consultoria Estrutural", status: "Concluído", client: "Construtora XYZ", value: "R$ 15k" },
  { id: 4, name: "Projeto Elétrico Galpão", status: "Em andamento", client: "Indústria 123", value: "R$ 85k" },
];

export default function DashboardNew() {
  const navigate = useNavigate();

  const KpiCard = ({ title, value, trend, icon: Icon, color }: any) => (
    <Card className="border-0 shadow-sm bg-white hover:shadow-md transition-all duration-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-2.5 rounded-xl ${color} bg-opacity-10`}>
            <Icon size={20} className={color.replace("bg-", "text-")} />
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400">
            <MoreHorizontal size={16} />
          </Button>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <h3 className="text-2xl font-bold tracking-tight text-gray-900">{value}</h3>
          <div className="flex items-center gap-1 mt-2">
            <span className="flex items-center text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
              <TrendingUp size={10} className="mr-1" />
              {trend}
            </span>
            <span className="text-xs text-gray-400">vs mês anterior</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Visão geral do seu desempenho hoje.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="text-sm" onClick={() => navigate('/relatorios')}>
            Exportar Relatório
          </Button>
          <Button className="text-sm bg-[#FF4000] hover:bg-[#FF4000]/90 text-white">
            Nova Transação
          </Button>
        </div>
      </div>

      {/* KPI Grid - Horizontal scroll on mobile if needed, or stacked */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          title="Receita Total" 
          value="R$ 45.231,89" 
          trend="+20.1%" 
          icon={DollarSign} 
          color="bg-green-500"
        />
        <KpiCard 
          title="Projetos Ativos" 
          value="12" 
          trend="+4" 
          icon={Briefcase} 
          color="bg-blue-500"
        />
        <KpiCard 
          title="Leads Novos" 
          value="28" 
          trend="+12%" 
          icon={UserPlus} 
          color="bg-purple-500"
        />
        <KpiCard 
          title="Clientes Totais" 
          value="145" 
          trend="+2.5%" 
          icon={Users} 
          color="bg-orange-500"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Financial Chart - Takes up 2 columns on large screens */}
        <Card className="lg:col-span-2 border-0 shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg font-medium">Fluxo Financeiro</CardTitle>
              <p className="text-sm text-gray-500">Receita x Despesas nos últimos 7 meses</p>
            </div>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/financeiro')}>
              Ver Detalhes <ArrowUpRight size={14} className="ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={financialData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF4000" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#FF4000" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9ca3af', fontSize: 12 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9ca3af', fontSize: 12 }} 
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#FF4000" 
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Leads Activity Chart - Takes up 1 column */}
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Atividade de Leads</CardTitle>
            <p className="text-sm text-gray-500">Novos contatos na última semana</p>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9ca3af', fontSize: 12 }} 
                    dy={10}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f3f4f6' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar 
                    dataKey="value" 
                    fill="#3b82f6" 
                    radius={[4, 4, 0, 0]} 
                    barSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Projects & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Projects List - Takes 2 columns */}
        <Card className="lg:col-span-2 border-0 shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-medium">Projetos Recentes</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/projetos')}>
              Ver Todos
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentProjects.map((project) => (
                <div key={project.id} className="flex items-center justify-between p-4 rounded-lg bg-gray-50/50 hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
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
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      project.status === 'Concluído' ? 'bg-green-100 text-green-700' :
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

        {/* Quick Actions / Support - Takes 1 column */}
        <div className="space-y-6">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-gray-900 to-gray-800 text-white">
            <CardContent className="p-6">
              <h3 className="text-lg font-medium mb-2">Precisa de ajuda?</h3>
              <p className="text-gray-300 text-sm mb-6">Nossa equipe de suporte está disponível para auxiliar com qualquer dúvida.</p>
              <Button className="w-full bg-white text-black hover:bg-gray-100 transition-colors border-0">
                Falar com Suporte
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider">Atalhos</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <Button variant="ghost" className="w-full justify-start text-gray-600 hover:text-[#FF4000] hover:bg-[#FF4000]/5">
                  <UserPlus size={16} className="mr-2" /> Adicionar Cliente
                </Button>
                <Button variant="ghost" className="w-full justify-start text-gray-600 hover:text-[#FF4000] hover:bg-[#FF4000]/5">
                  <Briefcase size={16} className="mr-2" /> Novo Projeto
                </Button>
                <Button variant="ghost" className="w-full justify-start text-gray-600 hover:text-[#FF4000] hover:bg-[#FF4000]/5">
                  <DollarSign size={16} className="mr-2" /> Registrar Despesa
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}

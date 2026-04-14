import { useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Briefcase,
  Building2,
  DollarSign,
  Mail,
  Pencil,
  Phone,
  PieChart,
  Plus,
  Search,
  Settings,
  Bell,
  Trash2,
  TrendingUp,
  TrendingDown,
  UserPlus,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type MockupTab = "dashboard" | "projetos" | "clientes";

export function MockupTablet() {
  const [activeMockupTab, setActiveMockupTab] = useState<MockupTab>("dashboard");

  return (
    <div className="relative max-w-5xl mx-auto reveal-up" style={{ transitionDelay: "200ms" }}>
      <div className="relative rounded-[2.5rem] bg-[#1a1a1a] p-2 sm:p-2 shadow-2xl ring-1 ring-white/10 hover:scale-[1.01] transition-transform duration-700">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-1 w-20 bg-white/10 rounded-b-lg" />
        <div className="absolute -left-1 top-20 h-10 w-1 bg-white/10 rounded-l-lg" />
        <div className="absolute -right-1 top-20 h-10 w-1 bg-white/10 rounded-r-lg" />

        <div className="relative rounded-[2rem] overflow-hidden bg-slate-50 aspect-[16/10] group font-sans">
          <div className="absolute inset-0 flex flex-col h-full w-full bg-[#f8f9fa]">
            <MockupHeader />

            <div className="flex-1 flex overflow-hidden">
              <MockupSidebar activeTab={activeMockupTab} onTabChange={setActiveMockupTab} />

              <div className="flex-1 overflow-hidden flex flex-col bg-[#f8f9fa] relative">
                {activeMockupTab === "dashboard" && <DashboardTab />}
                {activeMockupTab === "projetos" && <ProjetosTab />}
                {activeMockupTab === "clientes" && <ClientesTab />}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -top-20 -right-20 w-64 h-64 bg-accent-orange/20 rounded-full blur-3xl -z-10 animate-pulse duration-[5000ms]" />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl -z-10 animate-pulse duration-[7000ms]" />
    </div>
  );
}

function MockupHeader() {
  return (
    <div className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 shrink-0 z-20">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <img src="/pilar-logo.svg" alt="Pilar" className="h-6 w-6" />
          <span className="text-lg font-medium text-[#2E2E2E] hidden md:inline-block">Pilar</span>
        </div>
        <div className="h-6 w-px bg-gray-200 mx-2 hidden md:block" />
      </div>
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 cursor-pointer transition-colors shadow-sm">
          <Search className="w-4 h-4" />
        </div>
        <div className="h-9 w-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 cursor-pointer transition-colors shadow-sm relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-white"></span>
        </div>
        <div className="h-9 w-9 rounded-full bg-accent-orange text-white flex items-center justify-center text-xs font-medium cursor-pointer hover:bg-orange-600 transition-colors shadow-md shadow-orange-200">
          MR
        </div>
      </div>
    </div>
  );
}

function MockupSidebar({ activeTab, onTabChange }: { activeTab: MockupTab; onTabChange: (tab: MockupTab) => void }) {
  const tabs: { id: MockupTab; icon: React.ReactNode }[] = [
    { id: "dashboard", icon: <PieChart className="w-5 h-5" /> },
    { id: "projetos", icon: <Briefcase className="w-5 h-5" /> },
    { id: "clientes", icon: <Users className="w-5 h-5" /> },
  ];

  return (
    <div className="w-16 bg-white border-r border-gray-100 flex flex-col items-center py-6 gap-2 shrink-0 hidden md:flex z-10">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`p-3 rounded-xl transition-all cursor-pointer group relative ${
            activeTab === tab.id ? "bg-accent-orange/10 text-accent-orange" : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
          }`}
        >
          {tab.icon}
          {activeTab === tab.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-accent-orange rounded-r-full" />}
        </div>
      ))}
      <div className="p-3 text-gray-400 hover:bg-gray-50 hover:text-gray-600 rounded-xl cursor-pointer transition-colors">
        <DollarSign className="w-5 h-5" />
      </div>
      <div className="mt-auto p-3 text-gray-400 hover:bg-gray-50 hover:text-gray-600 rounded-xl cursor-pointer transition-colors">
        <Settings className="w-5 h-5" />
      </div>
    </div>
  );
}

function DashboardTab() {
  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500 h-full overflow-y-auto p-6 md:p-8">
      <div className="flex justify-between items-start md:items-center mb-8 gap-4">
        <div className="flex flex-col items-start text-left">
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">Visão geral do seu desempenho hoje</p>
        </div>
        <Button className="bg-accent-orange hover:bg-orange-600 text-white rounded-full shadow-lg shadow-orange-500/20 transition-all hover:scale-105 active:scale-95 text-xs md:text-sm font-medium h-10 px-6">
          Novo Lançamento
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8 text-left">
        {[
          { title: "Receitas", value: "R$ 48.250", change: "+12% vs mês anterior", color: "green", icon: <ArrowUpRight className="h-4 w-4" />, trend: <TrendingUp className="h-3 w-3 mr-1" /> },
          { title: "Despesas", value: "R$ 12.800", change: "-5% vs mês anterior", color: "red", icon: <ArrowDownRight className="h-4 w-4" />, trend: <TrendingDown className="h-3 w-3 mr-1" /> },
          { title: "Leads Novos", value: "24", change: "+8 novos hoje", color: "blue", icon: <UserPlus className="h-4 w-4" />, trend: <TrendingUp className="h-3 w-3 mr-1" /> },
          { title: "Projetos", value: "12", change: "Ativos no momento", color: "orange", icon: <Briefcase className="h-4 w-4" />, trend: null },
        ].map((stat) => (
          <Card key={stat.title} className="border-none shadow-[0_2px_20px_-8px_rgba(0,0,0,0.08)] hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-gray-500">{stat.title}</CardTitle>
              <div className={`p-2 bg-${stat.color === "orange" ? "orange" : stat.color}-50 text-${stat.color === "orange" ? "accent-orange" : `${stat.color}-600`} rounded-full`}>
                {stat.icon}
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold text-${stat.color === "orange" ? "accent-orange" : `${stat.color}-600`}`}>{stat.value}</div>
              <p className={`text-xs ${stat.trend ? "text-green-600" : "text-gray-400"} flex items-center mt-1 font-medium`}>
                {stat.trend}
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-[0_2px_20px_-8px_rgba(0,0,0,0.08)]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gray-400" />
              <CardTitle className="text-base font-semibold text-gray-800">Fluxo Financeiro</CardTitle>
            </div>
            <CardDescription className="text-left">Comparativo de Receitas x Despesas nos últimos meses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full flex items-end gap-3 px-2 pb-2">
              {[40, 65, 45, 80, 55, 90, 70, 50, 75, 60, 85, 95].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end gap-1.5 h-full group cursor-pointer">
                  <div className="w-full bg-accent-orange/80 rounded-t-sm transition-all duration-500 hover:bg-accent-orange relative" style={{ height: `${h}%` }}>
                    <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap transition-opacity pointer-events-none z-10">
                      R$ {h * 100}
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-t-sm transition-all duration-300 group-hover:bg-gray-300" style={{ height: `${h * 0.4}%` }}></div>
                  <div className="text-[10px] text-gray-400 text-center mt-1 font-medium hidden md:block">
                    {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][i]}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-[0_2px_20px_-8px_rgba(0,0,0,0.08)] flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-gray-400" />
              <CardTitle className="text-base font-semibold text-gray-800">Recentes</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-4 text-left">
              {[
                { name: "Residencial Cascata", client: "Dr. Roberto", color: "blue", initial: "R" },
                { name: "Reforma Comercial", client: "Grupo Pão de Açúcar", color: "yellow", initial: "C" },
                { name: "Interiores Apto 402", client: "Sra. Mariana", color: "green", initial: "I" },
              ].map((project, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-transparent hover:border-gray-100 hover:bg-gray-100/80 transition-all cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold ${
                        project.color === "blue" ? "bg-blue-100 text-blue-600" : project.color === "yellow" ? "bg-yellow-100 text-yellow-600" : "bg-green-100 text-green-600"
                      }`}
                    >
                      {project.initial}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 group-hover:text-accent-orange transition-colors">{project.name}</h4>
                      <p className="text-xs text-gray-500">{project.client}</p>
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${project.color === "blue" ? "bg-blue-500" : project.color === "yellow" ? "bg-yellow-500" : "bg-green-500"}`} />
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-4 text-xs text-gray-500 hover:text-accent-orange">
              Ver todos os projetos
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProjetosTab() {
  const columns = [
    {
      title: "Planejamento",
      count: 1,
      color: "bg-yellow-50",
      headerColor: "text-yellow-800",
      items: [{ title: "Casa de Veraneio", client: "Família Santos", code: "PROJ-042", value: "R$ 120k", type: "Residencial" }],
    },
    {
      title: "Em andamento",
      count: 2,
      color: "bg-blue-50",
      headerColor: "text-blue-800",
      items: [
        { title: "Reforma Shopping", client: "Grupo Almeida", code: "PROJ-038", value: "R$ 450k", type: "Comercial", progress: 60 },
        { title: "Edifício Horizon", client: "Construtora Tech", code: "PROJ-040", value: "R$ 2.5M", type: "Corporativo", progress: 30 },
      ],
    },
    {
      title: "Concluído",
      count: 1,
      color: "bg-green-50",
      headerColor: "text-green-800",
      items: [{ title: "Loja Centro", client: "Varejo S.A.", code: "PROJ-035", value: "R$ 85k", type: "Comercial", done: true }],
    },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500 h-full overflow-hidden flex flex-col p-6 md:p-8">
      <div className="flex justify-between items-center mb-8 gap-4">
        <div className="flex flex-col items-start text-left">
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Projetos</h2>
          <p className="text-sm text-gray-500 mt-1">Gerencie seus projetos em formato Kanban</p>
        </div>
        <Button className="bg-accent-orange hover:bg-orange-600 text-white rounded-full shadow-lg shadow-orange-500/20 text-xs md:text-sm font-medium h-10 px-4">
          <Plus className="w-4 h-4 mr-2" /> Novo Projeto
        </Button>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-6 overflow-hidden min-h-0 text-left">
        {columns.map((col, i) => (
          <div key={i} className="flex flex-col h-full bg-gray-50/50 rounded-xl border border-gray-200/60 shadow-sm overflow-hidden">
            <div className={`p-4 ${col.color} border-b border-gray-100 flex justify-between items-center`}>
              <h3 className={`text-sm font-bold ${col.headerColor}`}>{col.title}</h3>
              <Badge variant="secondary" className="bg-white/80 shadow-sm">
                {col.count}
              </Badge>
            </div>
            <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
              {col.items.map((item, idx) => (
                <Card key={idx} className="cursor-pointer hover:shadow-md transition-all hover:-translate-y-1 border-gray-100">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <Badge variant="outline" className="text-[10px] font-mono text-gray-500 border-gray-200">
                        {item.code}
                      </Badge>
                      {item.done && (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none text-[10px] px-1.5 h-5">Entregue</Badge>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800 leading-tight mb-1">{item.title}</h4>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Building2 className="w-3 h-3" /> {item.client}
                      </div>
                    </div>
                    {item.progress && (
                      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full rounded-full transition-all duration-1000" style={{ width: `${item.progress}%` }}></div>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-50 mt-1">
                      <div className="flex -space-x-1.5">
                        {[1, 2].map((p) => (
                          <div key={p} className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[8px] font-bold text-gray-500">
                            {String.fromCharCode(64 + p)}
                          </div>
                        ))}
                      </div>
                      <span className="text-xs font-medium text-gray-600 bg-gray-50 px-2 py-0.5 rounded">{item.value}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button variant="ghost" className="w-full border border-dashed border-gray-300 text-gray-400 hover:text-accent-orange hover:border-accent-orange/50 hover:bg-accent-orange/5 h-10 text-xs">
                <Plus className="w-3 h-3 mr-1.5" /> Adicionar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientesTab() {
  const clients = [
    { name: "Construtora Silva", email: "contato@silva.com", phone: "(11) 99887-6655", status: "Ativo", type: "PJ" },
    { name: "Mariana Oliveira", email: "mari.arq@email.com", phone: "(21) 98877-4433", status: "Ativo", type: "PF" },
    { name: "Grupo Empreendimentos", email: "financeiro@grupo.com", phone: "(31) 3344-5566", status: "Inativo", type: "PJ" },
    { name: "Roberto Santos", email: "beto.santos@uol.com.br", phone: "(11) 97766-5544", status: "Ativo", type: "PF" },
    { name: "Incorporadora Viva", email: "projetos@viva.com.br", phone: "(41) 3030-2020", status: "Ativo", type: "PJ" },
    { name: "Arquiteta Júlia", email: "julia@arq.com", phone: "(51) 98888-7777", status: "Ativo", type: "PF" },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500 h-full overflow-hidden flex flex-col p-6 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="flex flex-col items-start text-left">
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Clientes</h2>
          <p className="text-sm text-gray-500 mt-1">Gerencie sua base de clientes e parceiros</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Buscar cliente..." className="pl-9 h-10 bg-white border-gray-200 rounded-full text-sm" />
          </div>
          <Button className="bg-accent-orange hover:bg-orange-600 text-white rounded-full shadow-lg h-10 w-10 p-0 md:w-auto md:px-4 md:aspect-auto flex items-center justify-center">
            <Plus className="w-5 h-5 md:mr-2" /> <span className="hidden md:inline">Novo</span>
          </Button>
        </div>
      </div>

      <Card className="flex-1 border-none shadow-[0_2px_20px_-8px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 rounded-tl-lg">Nome</th>
                <th className="px-6 py-4 hidden sm:table-cell">Email</th>
                <th className="px-6 py-4 hidden md:table-cell">Contato</th>
                <th className="px-6 py-4 hidden lg:table-cell">Status</th>
                <th className="px-6 py-4 text-right rounded-tr-lg">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clients.map((client, i) => (
                <tr key={i} className="group hover:bg-gray-50/80 transition-colors cursor-pointer">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 bg-gray-100 border border-white shadow-sm">
                        <AvatarFallback className={`text-xs font-bold ${client.type === "PJ" ? "text-blue-600 bg-blue-50" : "text-accent-orange bg-orange-50"}`}>
                          {client.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-gray-900 group-hover:text-accent-orange transition-colors">{client.name}</div>
                        <div className="text-xs text-gray-400 sm:hidden">{client.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500 hidden sm:table-cell">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3 h-3 text-gray-300" />
                      {client.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500 hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3 h-3 text-gray-300" />
                      {client.phone}
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    <Badge
                      variant={client.status === "Ativo" ? "default" : "secondary"}
                      className={`${client.status === "Ativo" ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"} border-none font-normal`}
                    >
                      {client.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-500">Mostrando 6 de 24 clientes</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" disabled>
              Anterior
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              Próximo
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

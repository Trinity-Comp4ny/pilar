import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowRight, 
  BarChart3, 
  Check, 
  DollarSign, 
  FolderKanban, 
  Menu, 
  PieChart, 
  Users, 
  X,
  Building2,
  LineChart,
  LayoutTemplate,
  Instagram,
  Briefcase,
  UserPlus,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Search,
  Bell,
  Settings,
  MoreVertical,
  Plus,
  Filter,
  Pencil,
  Trash2,
  MapPin,
  Mail,
  Phone
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Landing() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeMockupTab, setActiveMockupTab] = useState<'dashboard' | 'projetos' | 'clientes'>('dashboard');

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkUser();
  }, [navigate]);

  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>(".reveal-up");
    if (!("IntersectionObserver" in window) || elements.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        }
      },
      { root: null, rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
    );

    elements.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const features = [
    {
      icon: <DollarSign className="w-6 h-6" />,
      title: "Financeiro Completo",
      description: "Fluxo de caixa, receitas, despesas e indicadores financeiros em tempo real para sua empresa."
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Gestão de Leads",
      description: "Pipeline visual para acompanhar suas oportunidades comerciais do contato ao fechamento."
    },
    {
      icon: <FolderKanban className="w-6 h-6" />,
      title: "Projetos",
      description: "Gerencie tarefas e etapas de cada projeto com visualização Kanban intuitiva."
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Pessoas",
      description: "Gerencie sua equipe, acompanhe desempenho e organize a estrutura organizacional."
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Metas Empresariais",
      description: "Defina objetivos estratégicos e acompanhe o progresso da sua empresa em tempo real."
    },
    {
      icon: <PieChart className="w-6 h-6" />,
      title: "Relatórios",
      description: "Dashboards que mostram a saúde do seu negócio para tomada de decisões."
    }
  ];

  const scrollToTop = (e: React.MouseEvent) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white text-[#2E2E2E] font-sans selection:bg-accent-orange/20 selection:text-accent-orange">
      {/* Top Bar */}
      <div className="fixed top-0 inset-x-0 z-[100] bg-[#2E2E2E] text-white text-[10px] md:text-xs py-2 flex justify-end px-6 md:px-10 border-b border-white/5 shadow-sm">
         <span className="opacity-80 font-light tracking-wide">Impulsionado por </span>
         <a href="https://trnty.com.br" target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-accent-orange transition-colors ml-1">Trinity Company</a>
      </div>

      {/* Header */}
      <header 
        className="fixed top-[32px] inset-x-0 z-50 bg-white border-b border-gray-100 py-4 shadow-sm transition-all duration-300"
      >
        <div className="container mx-auto px-6 md:px-10 flex items-center justify-between">
          <a href="#" onClick={scrollToTop} className="flex items-center gap-3 group">
            <img src="/pilar-logo.svg" alt="Pilar" className="h-8 w-8 transition-transform duration-500 group-hover:rotate-12" />
            <span className="text-xl font-medium tracking-tight text-[#2E2E2E]">Pilar</span>
          </a>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-normal">
            <a href="#funcionalidades" className="text-slate-600 hover:text-accent-orange transition-colors duration-300 hover:-translate-y-0.5">Funcionalidades</a>
            <a href="#sobre" className="text-slate-600 hover:text-accent-orange transition-colors duration-300 hover:-translate-y-0.5">Sobre</a>
            <Link 
              to="/login" 
              className="px-6 py-2.5 bg-accent-orange text-white rounded-full hover:bg-orange-600 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 duration-200 font-medium text-xs"
            >
              Acessar Sistema
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2 text-slate-600"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-black/5 p-6 flex flex-col gap-4 shadow-xl animate-in slide-in-from-top-5">
            <a href="#funcionalidades" className="text-lg font-medium text-slate-600" onClick={() => setMobileMenuOpen(false)}>Funcionalidades</a>
            <a href="#sobre" className="text-lg font-medium text-slate-600" onClick={() => setMobileMenuOpen(false)}>Sobre</a>
            <Link to="/login" className="text-lg font-medium text-accent-orange" onClick={() => setMobileMenuOpen(false)}>Entrar</Link>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden z-0">
        {/* Background Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-accent-orange/5 rounded-[100%] blur-3xl -z-10 animate-pulse duration-[10000ms]" />
        
        <div className="container mx-auto px-6 md:px-10 text-center">
          <div className="reveal-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-orange/10 text-accent-orange text-xs md:text-sm font-medium tracking-wide mb-8 hover:scale-105 transition-all duration-300 cursor-default animate-fade-in shadow-sm border border-accent-orange/20 ring-4 ring-accent-orange/5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-orange opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-orange"></span>
              </span>
              Gestão para Engenharia e Arquitetura1234
              Gestão para Engenharia e Arquitetura
            </div>
            
            <h1 className="text-5xl md:text-7xl font-medium tracking-tight text-[#2E2E2E] mb-8 leading-[1.1]">
              O pilar fundamental da <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-orange to-orange-600 animate-gradient-x">sua gestão.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
              Simplifique o controle financeiro, gestão de projetos e operação da sua empresa em uma única plataforma.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
              <Link
                to="/login"
                className="w-full sm:w-auto px-8 py-4 bg-accent-orange text-white rounded-full font-medium hover:bg-orange-600 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 flex items-center justify-center gap-2 group text-sm"
              >
                Começar
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="#funcionalidades"
                className="w-full sm:w-auto px-8 py-4 bg-white text-[#2E2E2E] border border-slate-200 rounded-full font-medium hover:bg-slate-50 transition-all hover:border-slate-300 text-sm"
              >
                Conhecer Recursos
              </a>
            </div>
          </div>

          {/* Tablet Dashboard Mockup */}
          <div className="relative max-w-5xl mx-auto reveal-up" style={{ transitionDelay: "200ms" }}>
            <div className="relative rounded-[2.5rem] bg-[#1a1a1a] p-2 sm:p-2 shadow-2xl ring-1 ring-white/10 hover:scale-[1.01] transition-transform duration-700">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 h-1 w-20 bg-white/10 rounded-b-lg" />
              <div className="absolute -left-1 top-20 h-10 w-1 bg-white/10 rounded-l-lg" />
              <div className="absolute -right-1 top-20 h-10 w-1 bg-white/10 rounded-r-lg" />
              
              <div className="relative rounded-[2rem] overflow-hidden bg-slate-50 aspect-[16/10] group font-sans">
                {/* Dashboard Mockup Content */}
                <div className="absolute inset-0 flex flex-col h-full w-full bg-[#f8f9fa]">
                  {/* Top Header Mockup */}
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

                  <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar Mockup */}
                    <div className="w-16 bg-white border-r border-gray-100 flex flex-col items-center py-6 gap-2 shrink-0 hidden md:flex z-10">
                       <div 
                         onClick={() => setActiveMockupTab('dashboard')}
                         className={`p-3 rounded-xl transition-all cursor-pointer group relative ${activeMockupTab === 'dashboard' ? 'bg-accent-orange/10 text-accent-orange' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
                       >
                         <PieChart className="w-5 h-5" />
                         {activeMockupTab === 'dashboard' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-accent-orange rounded-r-full" />}
                       </div>
                       <div 
                         onClick={() => setActiveMockupTab('projetos')}
                         className={`p-3 rounded-xl transition-all cursor-pointer group relative ${activeMockupTab === 'projetos' ? 'bg-accent-orange/10 text-accent-orange' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
                       >
                         <Briefcase className="w-5 h-5" />
                         {activeMockupTab === 'projetos' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-accent-orange rounded-r-full" />}
                       </div>
                       <div 
                         onClick={() => setActiveMockupTab('clientes')}
                         className={`p-3 rounded-xl transition-all cursor-pointer group relative ${activeMockupTab === 'clientes' ? 'bg-accent-orange/10 text-accent-orange' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
                       >
                         <Users className="w-5 h-5" />
                         {activeMockupTab === 'clientes' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-accent-orange rounded-r-full" />}
                       </div>
                       <div className="p-3 text-gray-400 hover:bg-gray-50 hover:text-gray-600 rounded-xl cursor-pointer transition-colors"><DollarSign className="w-5 h-5" /></div>
                       <div className="mt-auto p-3 text-gray-400 hover:bg-gray-50 hover:text-gray-600 rounded-xl cursor-pointer transition-colors"><Settings className="w-5 h-5" /></div>
                    </div>

                    {/* Main Content Mockup */}
                    <div className="flex-1 overflow-hidden flex flex-col bg-[#f8f9fa] relative">
                      
                      {/* DASHBOARD TAB */}
                      {activeMockupTab === 'dashboard' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500 h-full overflow-y-auto p-6 md:p-8">
                          {/* Page Title */}
                          <div className="flex justify-between items-start md:items-center mb-8 gap-4">
                            <div className="flex flex-col items-start text-left">
                              <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">
                                Dashboard
                              </h2>
                              <p className="text-sm text-gray-500 mt-1">
                                Visão geral do seu desempenho hoje
                              </p>
                            </div>
                            <Button className="bg-accent-orange hover:bg-orange-600 text-white rounded-full shadow-lg shadow-orange-500/20 transition-all hover:scale-105 active:scale-95 text-xs md:text-sm font-medium h-10 px-6">
                              Novo Lançamento
                            </Button>
                          </div>

                          {/* Stats Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8 text-left">
                            <Card className="border-none shadow-[0_2px_20px_-8px_rgba(0,0,0,0.08)] hover:shadow-lg transition-shadow duration-300">
                              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-sm font-medium text-gray-500">Receitas</CardTitle>
                                <div className="p-2 bg-green-50 text-green-600 rounded-full">
                                  <ArrowUpRight className="h-4 w-4" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-green-600">R$ 48.250</div>
                                <p className="text-xs text-green-600 flex items-center mt-1 font-medium">
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                  +12% vs mês anterior
                                </p>
                              </CardContent>
                            </Card>
                            
                            <Card className="border-none shadow-[0_2px_20px_-8px_rgba(0,0,0,0.08)] hover:shadow-lg transition-shadow duration-300">
                              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-sm font-medium text-gray-500">Despesas</CardTitle>
                                <div className="p-2 bg-red-50 text-red-600 rounded-full">
                                  <ArrowDownRight className="h-4 w-4" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-red-600">R$ 12.800</div>
                                <p className="text-xs text-green-600 flex items-center mt-1 font-medium">
                                  <TrendingDown className="h-3 w-3 mr-1" />
                                  -5% vs mês anterior
                                </p>
                              </CardContent>
                            </Card>

                            <Card className="border-none shadow-[0_2px_20px_-8px_rgba(0,0,0,0.08)] hover:shadow-lg transition-shadow duration-300">
                              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-sm font-medium text-gray-500">Leads Novos</CardTitle>
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-full">
                                  <UserPlus className="h-4 w-4" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-blue-600">24</div>
                                <p className="text-xs text-green-600 flex items-center mt-1 font-medium">
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                  +8 novos hoje
                                </p>
                              </CardContent>
                            </Card>

                            <Card className="border-none shadow-[0_2px_20px_-8px_rgba(0,0,0,0.08)] hover:shadow-lg transition-shadow duration-300">
                              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-sm font-medium text-gray-500">Projetos</CardTitle>
                                <div className="p-2 bg-orange-50 text-accent-orange rounded-full">
                                  <Briefcase className="h-4 w-4" />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-accent-orange">12</div>
                                <p className="text-xs text-gray-400 mt-1 font-medium">
                                  Ativos no momento
                                </p>
                              </CardContent>
                            </Card>
                          </div>

                          {/* Chart & Recent Projects */}
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Chart Area */}
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
                                  {/* Fake Bar Chart */}
                                  {[40, 65, 45, 80, 55, 90, 70, 50, 75, 60, 85, 95].map((h, i) => (
                                    <div key={i} className="flex-1 flex flex-col justify-end gap-1.5 h-full group cursor-pointer">
                                      <div className="w-full bg-accent-orange/80 rounded-t-sm transition-all duration-500 hover:bg-accent-orange relative" style={{ height: `${h}%` }}>
                                        <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap transition-opacity pointer-events-none z-10">R$ {h * 100}</div>
                                      </div>
                                      <div className="w-full bg-gray-200 rounded-t-sm transition-all duration-300 group-hover:bg-gray-300" style={{ height: `${h * 0.4}%` }}></div>
                                      <div className="text-[10px] text-gray-400 text-center mt-1 font-medium hidden md:block">
                                        {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][i]}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                            
                            {/* Recent Projects */}
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
                                    { name: "Residencial Cascata", client: "Dr. Roberto", status: "Em andamento", color: "blue", initial: "R" },
                                    { name: "Reforma Comercial", client: "Grupo Pão de Açúcar", status: "Planejamento", color: "yellow", initial: "C" },
                                    { name: "Interiores Apto 402", client: "Sra. Mariana", status: "Concluído", color: "green", initial: "I" },
                                  ].map((project, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-transparent hover:border-gray-100 hover:bg-gray-100/80 transition-all cursor-pointer group">
                                      <div className="flex items-center gap-3">
                                        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold ${
                                          project.color === 'blue' ? 'bg-blue-100 text-blue-600' : 
                                          project.color === 'yellow' ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'
                                        }`}>
                                          {project.initial}
                                        </div>
                                        <div>
                                          <h4 className="text-sm font-medium text-gray-900 group-hover:text-accent-orange transition-colors">{project.name}</h4>
                                          <p className="text-xs text-gray-500">{project.client}</p>
                                        </div>
                                      </div>
                                      <div className={`w-2 h-2 rounded-full ${
                                        project.color === 'blue' ? 'bg-blue-500' : 
                                        project.color === 'yellow' ? 'bg-yellow-500' : 'bg-green-500'
                                      }`} />
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
                      )}

                      {/* PROJETOS TAB */}
                      {activeMockupTab === 'projetos' && (
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
                            {[
                              { 
                                title: "Planejamento", 
                                count: 1, 
                                color: "bg-yellow-50", 
                                headerColor: "text-yellow-800",
                                badgeColor: "bg-yellow-100 text-yellow-800",
                                items: [
                                  { title: "Casa de Veraneio", client: "Família Santos", code: "PROJ-042", value: "R$ 120k", type: "Residencial" }
                                ]
                              },
                              { 
                                title: "Em andamento", 
                                count: 2, 
                                color: "bg-blue-50", 
                                headerColor: "text-blue-800",
                                badgeColor: "bg-blue-100 text-blue-800",
                                items: [
                                  { title: "Reforma Shopping", client: "Grupo Almeida", code: "PROJ-038", value: "R$ 450k", type: "Comercial", progress: 60 },
                                  { title: "Edifício Horizon", client: "Construtora Tech", code: "PROJ-040", value: "R$ 2.5M", type: "Corporativo", progress: 30 }
                                ]
                              },
                              { 
                                title: "Concluído", 
                                count: 1, 
                                color: "bg-green-50", 
                                headerColor: "text-green-800",
                                badgeColor: "bg-green-100 text-green-800",
                                items: [
                                  { title: "Loja Centro", client: "Varejo S.A.", code: "PROJ-035", value: "R$ 85k", type: "Comercial", done: true }
                                ]
                              }
                            ].map((col, i) => (
                              <div key={i} className="flex flex-col h-full bg-gray-50/50 rounded-xl border border-gray-200/60 shadow-sm overflow-hidden">
                                <div className={`p-4 ${col.color} border-b border-gray-100 flex justify-between items-center`}>
                                  <h3 className={`text-sm font-bold ${col.headerColor}`}>{col.title}</h3>
                                  <Badge variant="secondary" className="bg-white/80 shadow-sm">{col.count}</Badge>
                                </div>
                                <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                                  {col.items.map((item: any, idx) => (
                                    <Card key={idx} className="cursor-pointer hover:shadow-md transition-all hover:-translate-y-1 border-gray-100">
                                      <CardContent className="p-4 space-y-3">
                                        <div className="flex justify-between items-start">
                                          <Badge variant="outline" className="text-[10px] font-mono text-gray-500 border-gray-200">
                                            {item.code}
                                          </Badge>
                                          {item.done && <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none text-[10px] px-1.5 h-5">Entregue</Badge>}
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
                                              {[1,2].map(p => (
                                                <div key={p} className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[8px] font-bold text-gray-500">
                                                  {String.fromCharCode(64+p)}
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
                      )}

                      {/* CLIENTES TAB */}
                      {activeMockupTab === 'clientes' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500 h-full overflow-hidden flex flex-col p-6 md:p-8">
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                            <div className="flex flex-col items-start text-left">
                              <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Clientes</h2>
                              <p className="text-sm text-gray-500 mt-1">Gerencie sua base de clientes e parceiros</p>
                            </div>
                            <div className="flex items-center gap-2 w-full md:w-auto">
                              <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input 
                                  placeholder="Buscar cliente..." 
                                  className="pl-9 h-10 bg-white border-gray-200 rounded-full text-sm" 
                                />
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
                                  {[
                                    { name: "Construtora Silva", email: "contato@silva.com", phone: "(11) 99887-6655", status: "Ativo", type: "PJ" },
                                    { name: "Mariana Oliveira", email: "mari.arq@email.com", phone: "(21) 98877-4433", status: "Ativo", type: "PF" },
                                    { name: "Grupo Empreendimentos", email: "financeiro@grupo.com", phone: "(31) 3344-5566", status: "Inativo", type: "PJ" },
                                    { name: "Roberto Santos", email: "beto.santos@uol.com.br", phone: "(11) 97766-5544", status: "Ativo", type: "PF" },
                                    { name: "Incorporadora Viva", email: "projetos@viva.com.br", phone: "(41) 3030-2020", status: "Ativo", type: "PJ" },
                                    { name: "Arquiteta Júlia", email: "julia@arq.com", phone: "(51) 98888-7777", status: "Ativo", type: "PF" },
                                  ].map((client, i) => (
                                    <tr key={i} className="group hover:bg-gray-50/80 transition-colors cursor-pointer">
                                      <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                          <Avatar className="h-9 w-9 bg-gray-100 border border-white shadow-sm">
                                            <AvatarFallback className={`text-xs font-bold ${
                                              client.type === 'PJ' ? 'text-blue-600 bg-blue-50' : 'text-accent-orange bg-orange-50'
                                            }`}>
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
                                        <Badge variant={client.status === 'Ativo' ? 'default' : 'secondary'} className={`${
                                          client.status === 'Ativo' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                        } border-none font-normal`}>
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
                                <Button variant="outline" size="sm" className="h-8 text-xs" disabled>Anterior</Button>
                                <Button variant="outline" size="sm" className="h-8 text-xs">Próximo</Button>
                              </div>
                            </div>
                          </Card>
                        </div>
                      )}

                    </div>
                  </div>
                </div>

                {/* Overlay gradient to blend bottom if needed - removed for clean look */}
              </div>
            </div>
            
            {/* Decoration blobs */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-accent-orange/20 rounded-full blur-3xl -z-10 animate-pulse duration-[5000ms]" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl -z-10 animate-pulse duration-[7000ms]" />
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="funcionalidades" className="py-24 bg-white text-[#2E2E2E] relative overflow-hidden scroll-mt-20">
        <div className="container mx-auto px-6 md:px-10 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16 reveal-up">
            <h2 className="text-3xl md:text-4xl font-medium mb-4 text-[#2E2E2E]">Tudo em um só lugar</h2>
            <p className="text-slate-600 text-lg font-light">
              Centralize a gestão da sua empresa com ferramentas conectadas que eliminam planilhas e retrabalho.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <div 
                key={i} 
                className="bg-white p-8 rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-2 hover:bg-orange-50 border border-slate-100 group reveal-up cursor-default hover:shadow-md hover:border-accent-orange/20"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="w-12 h-12 rounded-xl bg-accent-orange/10 flex items-center justify-center text-accent-orange mb-6 group-hover:bg-accent-orange group-hover:text-white transition-all duration-300 group-hover:scale-110">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-medium text-[#2E2E2E] mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed font-light">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sobre Nós - Redesigned */}
      <section id="sobre" className="py-24 bg-[#2E2E2E] relative overflow-hidden text-white scroll-mt-20">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        
        <div className="container mx-auto px-6 md:px-10 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="reveal-up">
              
              <h2 className="text-4xl md:text-5xl font-medium text-white mb-6 leading-tight">
                Construído para quem <br />
                <span className="text-accent-orange">constrói o futuro</span>
              </h2>
              
              <p className="text-lg text-slate-300 mb-8 leading-relaxed font-light">
                Somos uma plataforma de gestão criada especificamente para empresas de Engenharia e Arquitetura. Nossa missão é simplificar a gestão financeira e operacional, permitindo que você foque no que realmente importa: seus projetos.
              </p>
            </div>

            <div className="grid gap-6 reveal-up" style={{ transitionDelay: "200ms" }}>
              {[
                {
                  icon: <LayoutTemplate className="w-5 h-5" />,
                  title: "Interface Intuitiva",
                  desc: "Design limpo e pensado para a usabilidade diária."
                },
                {
                  icon: <Building2 className="w-5 h-5" />,
                  title: "Foco no Setor",
                  desc: "Funcionalidades específicas para engenheiros e arquitetos."
                },
                {
                  icon: <LineChart className="w-5 h-5" />,
                  title: "Evolução Constante",
                  desc: "Atualizações frequentes baseadas no feedback de clientes."
                }
              ].map((item, i) => (
                <div key={i} className="bg-white/5 border border-white/10 p-6 rounded-xl hover:bg-white/10 transition-all duration-300 group flex items-start gap-4 backdrop-blur-sm">
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0 group-hover:bg-accent-orange transition-colors duration-300">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-white mb-1">{item.title}</h3>
                    <p className="text-sm text-slate-400 font-light">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-white relative overflow-hidden border-t border-slate-100">
        <div className="container mx-auto px-6 md:px-10 text-center relative z-10">
          <div className="reveal-up">
            <h2 className="text-3xl md:text-5xl font-medium text-[#2E2E2E] mb-6">
              Pronto para transformar sua gestão?
            </h2>
            <p className="text-slate-600 text-lg md:text-xl max-w-2xl mx-auto mb-10 font-light">
              Junte-se aos escritórios que já modernizaram seus processos com a Pilar. Comece hoje mesmo.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/login"
                className="w-full sm:w-auto px-10 py-4 bg-accent-orange text-white rounded-full font-medium text-sm hover:bg-orange-600 transition-all shadow-lg hover:shadow-orange-500/25 hover:-translate-y-1"
              >
                Acessar Sistema
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#2E2E2E] text-white py-12 border-t border-white/5">
        <div className="container mx-auto px-6 md:px-10">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <img src="/pilar-logo.svg" alt="Pilar" className="h-8 w-8 brightness-0 invert hover:rotate-12 transition-transform duration-300" />
                <span className="text-xl font-medium tracking-tight">Pilar</span>
              </div>
              <p className="text-slate-400 max-w-sm mb-6 font-light leading-relaxed">
                O sistema de gestão definitivo para escritórios de engenharia e arquitetura. Simples, bonito e eficiente.
              </p>
              <div className="flex gap-4">
                {/* Social icons */}
                <a href="https://www.instagram.com/trinitycomp4ny/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer text-white/60 hover:text-white hover:scale-110 duration-300">
                  <span className="sr-only">Instagram</span>
                  <Instagram className="w-5 h-5" />
                </a>
                <a href="https://www.linkedin.com/company/trnty-company" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer text-white/60 hover:text-white hover:scale-110 duration-300">
                   <span className="sr-only">LinkedIn</span>
                   <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                </a>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-semibold mb-6 tracking-wider text-white">Produto</h4>
              <ul className="space-y-4 text-slate-400 font-light text-sm">
                <li><a href="#funcionalidades" className="hover:text-accent-orange transition-colors">Funcionalidades</a></li>
                <li><a href="#sobre" className="hover:text-accent-orange transition-colors">Sobre Nós</a></li>
                <li><Link to="/login" className="hover:text-accent-orange transition-colors">Entrar</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-6 tracking-wider text-white">Legal</h4>
              <ul className="space-y-4 text-slate-400 font-light text-sm">
                <li><a href="#" className="hover:text-accent-orange transition-colors">Termos de Uso</a></li>
                <li><a href="#" className="hover:text-accent-orange transition-colors">Privacidade</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500 font-light">
            <p>© {new Date().getFullYear()} Pilar. Todos os direitos reservados.</p>
            <div className="flex items-center gap-1">
              <span>Impulsionado por</span>
              <a href="https://trnty.com.br" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-accent-orange transition-colors font-medium">Trinity Company</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

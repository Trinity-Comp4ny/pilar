import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  LayoutGrid,
  LayoutList,
  Lock,
  MapPin,
  Pencil,
  PieChart,
  Plus,
  Search,
  Settings,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type MockupTab = "dashboard" | "projetos" | "clientes" | "financeiro";

interface Project {
  title: string;
  client: string;
  code: string;
  value: string;
  status: "Planejamento" | "Em andamento" | "Concluído";
  progress: number;
  type: string;
  team: string[];
  timeline: { label: string; date: string; done: boolean }[];
}

// ─── helpers ────────────────────────────────────────────────────────────────

function Sparkline({ data, color = "#f97316" }: { data: number[]; color?: string }) {
  const W = 52;
  const H = 20;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / range) * (H - 3) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={W} height={H} className="shrink-0 opacity-60">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DonutChart({ segments }: { segments: { value: number; color: string }[] }) {
  const r = 28;
  const cx = 40;
  const cy = 40;
  const C = 2 * Math.PI * r;
  let cum = 0;
  return (
    <svg viewBox="0 0 80 80" className="w-full h-full" style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth="11" />
      {segments.map((seg, i) => {
        const dash = (seg.value / 100) * C;
        const off = -(cum / 100) * C;
        cum += seg.value;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="11"
            strokeDasharray={`${dash} ${C}`}
            strokeDashoffset={off}
            className="transition-all duration-700"
          />
        );
      })}
    </svg>
  );
}

// ─── root ───────────────────────────────────────────────────────────────────

export function MockupTablet() {
  const [activeMockupTab, setActiveMockupTab] = useState<MockupTab>("dashboard");

  return (
    <div className="relative max-w-5xl mx-auto reveal-up hidden md:block" style={{ transitionDelay: "200ms" }}>
      {/* Blobs de glow com aurora */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-brand/18 rounded-full blur-3xl -z-10 animate-aurora" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-blue-500/12 rounded-full blur-3xl -z-10 animate-aurora-alt" />

      {/* Float wrapper */}
      <div className="animate-float">
        <div className="relative rounded-[2.5rem] bg-ink-soft p-2 shadow-2xl ring-1 ring-white/10 hover:scale-[1.005] transition-transform duration-700">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-1 w-20 bg-white/10 rounded-b-lg" />
          <div className="absolute -left-1 top-20 h-10 w-1 bg-white/10 rounded-l-lg" />
          <div className="absolute -right-1 top-20 h-10 w-1 bg-white/10 rounded-r-lg" />

          <div className="relative rounded-[2rem] overflow-hidden bg-slate-50 aspect-[16/10] font-sans">
            <div className="absolute inset-0 flex flex-col h-full w-full bg-gray-50">
              <MockupHeader />
              <div className="flex-1 flex overflow-hidden">
                <MockupSidebar activeTab={activeMockupTab} onTabChange={setActiveMockupTab} />
                <div className="flex-1 overflow-hidden flex flex-col bg-gray-50">
                  {activeMockupTab === "dashboard" && <DashboardTab />}
                  {activeMockupTab === "projetos" && <ProjetosTab />}
                  {activeMockupTab === "clientes" && <ClientesTab />}
                  {activeMockupTab === "financeiro" && <FinanceiroTab />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── header ─────────────────────────────────────────────────────────────────

function MockupHeader() {
  return (
    <div className="h-12 bg-white border-b border-gray-100 flex items-center justify-between px-5 shrink-0 z-20">
      <div className="flex items-center gap-2">
        <img src="/pilar-logo.svg" alt="Pilar" className="h-5 w-5" />
        <span className="text-sm font-semibold text-ink-soft hidden md:inline-block">
          Pilar<sup className="text-[7px] font-normal text-slate-400 ml-0.5 relative -top-1.5">®</sup>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 cursor-pointer shadow-sm">
          <Search className="w-3.5 h-3.5" />
        </div>
        {/* Notification com ping */}
        <div className="h-8 w-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 cursor-pointer shadow-sm relative">
          <Bell className="w-3.5 h-3.5" />
          <span className="absolute top-1 right-1.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
        </div>
        <div className="h-8 w-8 rounded-full bg-brand text-ink flex items-center justify-center text-xs font-medium cursor-pointer shadow-md shadow-brand/40">
          MR
        </div>
      </div>
    </div>
  );
}

// ─── sidebar ─────────────────────────────────────────────────────────────────

function MockupSidebar({ activeTab, onTabChange }: { activeTab: MockupTab; onTabChange: (tab: MockupTab) => void }) {
  const tabs: { id: MockupTab; icon: React.ReactNode; label: string }[] = [
    { id: "dashboard", icon: <PieChart className="w-4 h-4" />, label: "Dashboard" },
    { id: "projetos", icon: <Briefcase className="w-4 h-4" />, label: "Projetos" },
    { id: "clientes", icon: <Users className="w-4 h-4" />, label: "Clientes" },
    { id: "financeiro", icon: <DollarSign className="w-4 h-4" />, label: "Financeiro" },
  ];

  const locked: { icon: React.ReactNode; label: string }[] = [
    { icon: <FileText className="w-4 h-4" />, label: "Propostas" },
    { icon: <Target className="w-4 h-4" />, label: "Leads" },
    { icon: <UserCheck className="w-4 h-4" />, label: "Equipe" },
    { icon: <MapPin className="w-4 h-4" />, label: "Mapa" },
  ];

  return (
    <div className="w-14 bg-white border-r border-gray-100 flex flex-col items-center py-4 gap-1 shrink-0 hidden md:flex z-10">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`p-2.5 rounded-xl transition-all cursor-pointer relative ${
            activeTab === tab.id ? "bg-brand/10 text-brand" : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
          }`}
        >
          {tab.icon}
          {activeTab === tab.id && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 bg-brand rounded-r-full" />
          )}
        </div>
      ))}

      <div className="w-6 border-t border-gray-100 my-1.5" />

      {locked.map((item) => (
        <div key={item.label} className="relative group">
          <div className="p-2.5 rounded-xl text-gray-200 cursor-not-allowed relative select-none">
            <span className="opacity-50">{item.icon}</span>
            <Lock className="absolute bottom-0.5 right-0.5 w-2 h-2 text-gray-300" />
          </div>
          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50 shadow-lg flex items-center gap-1.5">
            {item.label}
            <span className="bg-brand/90 text-white text-[8px] px-1 py-px rounded font-semibold tracking-wide">
              PRO
            </span>
          </div>
        </div>
      ))}

      <div className="mt-auto p-2.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600 rounded-xl cursor-pointer transition-colors">
        <Settings className="w-4 h-4" />
      </div>
    </div>
  );
}

// ─── dashboard ───────────────────────────────────────────────────────────────

const SPARK = {
  receitas: [38, 42, 45, 55, 48, 65, 58, 72, 68, 80, 85, 95],
  despesas: [52, 48, 55, 44, 50, 44, 48, 42, 45, 41, 38, 40],
  leads: [14, 18, 12, 20, 16, 22, 18, 25, 21, 24, 22, 24],
  projetos: [8, 9, 10, 11, 10, 12, 11, 13, 12, 12, 11, 12],
};

function DashboardTab() {
  const [period, setPeriod] = useState<"mes" | "trim" | "ano">("mes");
  const [barsReady, setBarsReady] = useState(false);

  const chartConfig = {
    mes: {
      data: [40, 65, 45, 80, 55, 90, 70, 50, 75, 60, 85, 95],
      labels: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"],
    },
    trim: { data: [65, 78, 55, 85], labels: ["T1", "T2", "T3", "T4"] },
    ano: { data: [55, 70, 82, 91], labels: ["2021", "2022", "2023", "2024"] },
  };
  const { data, labels } = chartConfig[period];

  useEffect(() => {
    setBarsReady(false);
    const t = setTimeout(() => setBarsReady(true), 60);
    return () => clearTimeout(t);
  }, [period]);

  // também anima na montagem inicial
  useEffect(() => {
    const t = setTimeout(() => setBarsReady(true), 120);
    return () => clearTimeout(t);
  }, []);

  const kpis = [
    {
      title: "Receitas",
      value: "R$ 48.250",
      change: "+12%",
      up: true as boolean | null,
      bg: "bg-green-100",
      text: "text-green-800",
      icon: <ArrowUpRight className="h-3.5 w-3.5" />,
      spark: SPARK.receitas,
      sc: "#22c55e",
    },
    {
      title: "Despesas",
      value: "R$ 12.800",
      change: "-5%",
      up: false as boolean | null,
      bg: "bg-red-50",
      text: "text-red-500",
      icon: <ArrowDownRight className="h-3.5 w-3.5" />,
      spark: SPARK.despesas,
      sc: "#ef4444",
    },
    {
      title: "Leads",
      value: "24",
      change: "+8 hoje",
      up: true as boolean | null,
      bg: "bg-blue-50",
      text: "text-blue-600",
      icon: <UserPlus className="h-3.5 w-3.5" />,
      spark: SPARK.leads,
      sc: "#3b82f6",
    },
    {
      title: "Projetos",
      value: "12",
      change: "ativos",
      up: null as boolean | null,
      bg: "bg-orange-50",
      text: "text-brand",
      icon: <Briefcase className="h-3.5 w-3.5" />,
      spark: SPARK.projetos,
      sc: "#f97316",
    },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500 h-full overflow-hidden flex flex-col p-4">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Dashboard</h2>
          <p className="text-xs text-gray-500">Visão geral do desempenho</p>
        </div>
        <div className="flex items-center gap-1.5">
          {(["mes", "trim", "ano"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                period === p
                  ? "bg-brand text-white shadow-sm"
                  : "bg-white text-gray-500 border border-gray-200 hover:border-brand/40"
              }`}
            >
              {p === "mes" ? "Mês" : p === "trim" ? "Trim." : "Ano"}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards com sparklines */}
      <div className="grid grid-cols-4 gap-3 mb-3 shrink-0">
        {kpis.map((stat) => (
          <Card key={stat.title} className="border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-gray-500 font-medium">{stat.title}</span>
                <div className={`p-1.5 rounded-full ${stat.bg}`}>
                  <span className={stat.text}>{stat.icon}</span>
                </div>
              </div>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className={`text-base font-bold ${stat.text}`}>{stat.value}</div>
                  <p
                    className={`text-[10px] flex items-center mt-0.5 ${stat.up === true ? "text-green-800" : stat.up === false ? "text-red-500" : "text-gray-400"}`}
                  >
                    {stat.up === true && <TrendingUp className="h-2.5 w-2.5 mr-0.5" />}
                    {stat.up === false && <TrendingDown className="h-2.5 w-2.5 mr-0.5" />}
                    {stat.change}
                  </p>
                </div>
                <Sparkline data={stat.spark} color={stat.sc} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* charts */}
      <div className="grid grid-cols-3 gap-3 flex-1 min-h-0">
        <Card className="col-span-2 border-none shadow-sm flex flex-col min-h-0">
          <CardHeader className="p-3 pb-1 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4 text-gray-400" />
                <CardTitle className="text-xs font-semibold text-gray-800">Fluxo Financeiro</CardTitle>
              </div>
              <div className="flex gap-3 text-[10px] text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-brand/80 inline-block" /> Receitas
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-gray-200 inline-block" /> Despesas
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-3 pt-1">
            <div className="h-full flex items-end gap-1.5 pb-4">
              {data.map((h, i) => (
                <div
                  key={`${period}-${i}`}
                  className="flex-1 flex flex-col justify-end gap-0.5 h-full group cursor-pointer"
                >
                  {/* tooltip rico */}
                  <div className="relative flex-1 flex flex-col justify-end">
                    <div
                      className="w-full bg-brand/75 rounded-t-sm hover:bg-brand"
                      style={{
                        height: barsReady ? `${h}%` : "0%",
                        transition: `height ${380 + i * 22}ms cubic-bezier(0.16,1,0.3,1)`,
                      }}
                    />
                    <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-gray-900 text-white text-[9px] px-2 py-1.5 rounded-lg whitespace-nowrap pointer-events-none z-20 shadow-xl">
                      <div className="font-semibold text-brand">R$ {(h * 500).toLocaleString("pt-BR")}</div>
                      <div className="text-gray-400 text-[8px]">
                        Desp: R$ {Math.round(h * 175).toLocaleString("pt-BR")}
                      </div>
                      <div className="text-green-600 text-[8px]">
                        Lucro: R$ {Math.round(h * 325).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  </div>
                  <div
                    className="w-full bg-gray-200 rounded-t-sm"
                    style={{
                      height: barsReady ? `${Math.round(h * 0.35)}%` : "0%",
                      transition: `height ${380 + i * 22}ms cubic-bezier(0.16,1,0.3,1)`,
                    }}
                  />
                  <span className="text-[8px] text-gray-400 text-center">{labels[i]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm flex flex-col min-h-0">
          <CardHeader className="p-3 pb-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <Briefcase className="h-4 w-4 text-gray-400" />
              <CardTitle className="text-xs font-semibold text-gray-800">Recentes</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-1 space-y-1.5">
            {[
              { name: "Residencial Cascata", client: "Dr. Roberto", color: "blue", initial: "R", pct: 75 },
              { name: "Reforma Comercial", client: "Grupo Almeida", color: "yellow", initial: "C", pct: 45 },
              { name: "Interiores Apto 402", client: "Sra. Mariana", color: "green", initial: "I", pct: 90 },
            ].map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer group transition-colors"
              >
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${p.color === "blue" ? "bg-blue-100 text-blue-600" : p.color === "yellow" ? "bg-yellow-100 text-yellow-600" : "bg-green-100 text-green-900"}`}
                >
                  {p.initial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 group-hover:text-brand transition-colors truncate">
                    {p.name}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="flex-1 bg-gray-100 h-1 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${p.color === "blue" ? "bg-blue-400" : p.color === "yellow" ? "bg-yellow-400" : "bg-green-500"}`}
                        style={{ width: `${p.pct}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-gray-400">{p.pct}%</span>
                  </div>
                </div>
              </div>
            ))}
            <Button variant="ghost" className="w-full text-[10px] text-gray-400 hover:text-brand h-7 mt-1">
              Ver todos →
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── projetos ────────────────────────────────────────────────────────────────

const PROJECTS: Project[] = [
  {
    title: "Casa de Veraneio",
    client: "Família Santos",
    code: "PROJ-042",
    value: "R$ 120k",
    status: "Planejamento",
    progress: 0,
    type: "Residencial",
    team: ["AS", "MC", "JR"],
    timeline: [
      { label: "Briefing aprovado", date: "10 Mar", done: true },
      { label: "Projeto conceitual", date: "28 Mar", done: true },
      { label: "Projeto executivo", date: "20 Abr", done: false },
      { label: "Entrega final", date: "15 Jun", done: false },
    ],
  },
  {
    title: "Reforma Shopping",
    client: "Grupo Almeida",
    code: "PROJ-038",
    value: "R$ 450k",
    status: "Em andamento",
    progress: 60,
    type: "Comercial",
    team: ["MR", "PT", "KL"],
    timeline: [
      { label: "Contrato assinado", date: "05 Jan", done: true },
      { label: "Levantamento concluído", date: "20 Jan", done: true },
      { label: "Em execução", date: "01 Fev", done: true },
      { label: "Entrega prevista", date: "30 Mai", done: false },
    ],
  },
  {
    title: "Edifício Horizon",
    client: "Construtora Tech",
    code: "PROJ-040",
    value: "R$ 2.5M",
    status: "Em andamento",
    progress: 30,
    type: "Corporativo",
    team: ["MR", "AS"],
    timeline: [
      { label: "Proposta aprovada", date: "15 Fev", done: true },
      { label: "Projeto iniciado", date: "01 Mar", done: true },
      { label: "Revisão de escopo", date: "15 Mai", done: false },
      { label: "Entrega prevista", date: "30 Ago", done: false },
    ],
  },
  {
    title: "Loja Centro",
    client: "Varejo S.A.",
    code: "PROJ-035",
    value: "R$ 85k",
    status: "Concluído",
    progress: 100,
    type: "Comercial",
    team: ["JR", "KL"],
    timeline: [
      { label: "Projeto aprovado", date: "10 Nov", done: true },
      { label: "Execução iniciada", date: "01 Dez", done: true },
      { label: "Entregue", date: "28 Fev", done: true },
    ],
  },
];

function ProjetosTab() {
  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [selected, setSelected] = useState<Project | null>(null);

  const columns = [
    {
      title: "Planejamento",
      color: "bg-yellow-50",
      headerColor: "text-yellow-800",
      items: PROJECTS.filter((p) => p.status === "Planejamento"),
    },
    {
      title: "Em andamento",
      color: "bg-blue-50",
      headerColor: "text-blue-800",
      items: PROJECTS.filter((p) => p.status === "Em andamento"),
    },
    {
      title: "Concluído",
      color: "bg-green-100",
      headerColor: "text-green-900",
      items: PROJECTS.filter((p) => p.status === "Concluído"),
    },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500 h-full overflow-hidden flex flex-col p-4">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Projetos</h2>
          <p className="text-xs text-gray-500">{PROJECTS.length} projetos no total</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 p-0.5 rounded-lg">
            <button
              onClick={() => setView("kanban")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 ${view === "kanban" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
            >
              <LayoutGrid className="w-3 h-3" /> Kanban
            </button>
            <button
              onClick={() => setView("lista")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 ${view === "lista" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
            >
              <LayoutList className="w-3 h-3" /> Lista
            </button>
          </div>
          <Button className="bg-brand hover:bg-brand/90 text-ink rounded-full text-xs h-8 px-3 shadow-sm">
            <Plus className="w-3 h-3 mr-1" /> Novo
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {view === "kanban" ? (
          <div className="h-full grid grid-cols-3 gap-4">
            {columns.map((col, i) => (
              <div
                key={i}
                className="flex flex-col bg-gray-50/50 rounded-xl border border-gray-200/60 shadow-sm overflow-hidden"
              >
                <div
                  className={`px-4 py-2.5 ${col.color} border-b border-gray-100 flex justify-between items-center shrink-0`}
                >
                  <h3 className={`text-xs font-bold ${col.headerColor}`}>{col.title}</h3>
                  <Badge variant="secondary" className="bg-white/80 shadow-sm text-xs h-5">
                    {col.items.length}
                  </Badge>
                </div>
                <div className="p-2.5 space-y-2">
                  {col.items.map((item, idx) => (
                    <Card
                      key={idx}
                      onClick={() => setSelected(selected?.code === item.code ? null : item)}
                      className={`cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 border-gray-100 ${selected?.code === item.code ? "ring-2 ring-brand/50" : ""}`}
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="flex justify-between items-start">
                          <Badge
                            variant="outline"
                            className="text-[9px] font-mono text-gray-400 border-gray-200 h-4 px-1.5"
                          >
                            {item.code}
                          </Badge>
                          {item.status === "Concluído" && (
                            <Badge className="bg-green-100 text-green-900 border-none text-[9px] px-1.5 h-4">
                              Entregue
                            </Badge>
                          )}
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-gray-800 mb-0.5">{item.title}</h4>
                          <div className="flex items-center gap-1 text-[10px] text-gray-500">
                            <Building2 className="w-2.5 h-2.5" /> {item.client}
                          </div>
                        </div>
                        {item.progress > 0 && item.progress < 100 && (
                          <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${item.progress}%` }} />
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-1.5 border-t border-gray-50">
                          <div className="flex -space-x-1">
                            {item.team.slice(0, 2).map((m, p) => (
                              <div
                                key={p}
                                className="w-5 h-5 rounded-full bg-brand/10 border-2 border-white flex items-center justify-center text-[7px] font-bold text-brand"
                              >
                                {m}
                              </div>
                            ))}
                          </div>
                          <span className="text-[10px] font-medium text-gray-600">{item.value}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  <Button
                    variant="ghost"
                    className="w-full border border-dashed border-gray-200 text-gray-400 hover:text-brand hover:border-brand/40 h-8 text-[10px]"
                  >
                    <Plus className="w-2.5 h-2.5 mr-1" /> Adicionar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card className="h-full border-none shadow-sm overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-2.5 font-medium text-gray-500">Projeto</th>
                  <th className="px-4 py-2.5 font-medium text-gray-500">Cliente</th>
                  <th className="px-4 py-2.5 font-medium text-gray-500">Status</th>
                  <th className="px-4 py-2.5 font-medium text-gray-500">Progresso</th>
                  <th className="px-4 py-2.5 font-medium text-gray-500 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {PROJECTS.map((p, i) => (
                  <tr
                    key={i}
                    onClick={() => setSelected(selected?.code === p.code ? null : p)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 group-hover:text-brand transition-colors">
                        {p.title}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">{p.code}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.client}</td>
                    <td className="px-4 py-3">
                      <Badge
                        className={`border-none font-normal text-[10px] ${p.status === "Concluído" ? "bg-green-100 text-green-900" : p.status === "Em andamento" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"}`}
                      >
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${p.status === "Concluído" ? "bg-green-1000" : "bg-blue-500"}`}
                            style={{ width: `${p.progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400">{p.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-700">{p.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* Painel detalhe — overlay slide-in */}
        {selected && (
          <div className="absolute inset-y-0 right-0 w-64 bg-white border-l border-gray-100 shadow-2xl z-20 animate-in slide-in-from-right duration-300 flex flex-col overflow-hidden">
            <div className="p-3.5 border-b border-gray-100 flex items-start justify-between">
              <div>
                <Badge variant="outline" className="text-[9px] font-mono text-gray-400 border-gray-200 h-4 px-1.5 mb-1">
                  {selected.code}
                </Badge>
                <h3 className="text-sm font-semibold text-gray-900 leading-tight">{selected.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{selected.client}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 p-3 border-b border-gray-100">
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-[9px] text-gray-500 mb-0.5">Valor</p>
                <p className="text-sm font-bold text-brand">{selected.value}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-[9px] text-gray-500 mb-0.5">Tipo</p>
                <p className="text-xs font-semibold text-gray-800">{selected.type}</p>
              </div>
            </div>

            <div className="p-3 border-b border-gray-100">
              <div className="flex justify-between items-center mb-1.5">
                <p className="text-[10px] font-medium text-gray-600">Progresso</p>
                <p className="text-[10px] font-bold text-gray-800">{selected.progress}%</p>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${selected.status === "Concluído" ? "bg-green-1000" : "bg-blue-500"}`}
                  style={{ width: `${selected.progress}%` }}
                />
              </div>
            </div>

            <div className="p-3 border-b border-gray-100">
              <p className="text-[10px] font-medium text-gray-600 mb-2">Equipe</p>
              <div className="flex -space-x-1.5">
                {selected.team.map((m, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full bg-brand/10 border-2 border-white flex items-center justify-center text-[9px] font-bold text-brand"
                  >
                    {m}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 flex-1 overflow-hidden">
              <p className="text-[10px] font-medium text-gray-600 mb-2.5">Timeline</p>
              <div className="space-y-2.5">
                {selected.timeline.map((ev, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-px ${ev.done ? "bg-green-100" : "bg-gray-100"}`}
                    >
                      {ev.done ? (
                        <CheckCircle2 className="w-3 h-3 text-green-800" />
                      ) : (
                        <Clock className="w-3 h-3 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className={`text-[10px] font-medium ${ev.done ? "text-gray-700" : "text-gray-400"}`}>
                        {ev.label}
                      </p>
                      <p className="text-[9px] text-gray-400">{ev.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── clientes ────────────────────────────────────────────────────────────────

const ALL_CLIENTS = [
  { name: "Construtora Silva", email: "contato@silva.com", phone: "(11) 99887-6655", status: "Ativo", type: "PJ" },
  { name: "Mariana Oliveira", email: "mari.arq@email.com", phone: "(21) 98877-4433", status: "Ativo", type: "PF" },
  {
    name: "Grupo Empreendimentos",
    email: "financeiro@grupo.com",
    phone: "(31) 3344-5566",
    status: "Inativo",
    type: "PJ",
  },
  { name: "Roberto Santos", email: "beto.santos@uol.com.br", phone: "(11) 97766-5544", status: "Ativo", type: "PF" },
  { name: "Incorporadora Viva", email: "projetos@viva.com.br", phone: "(41) 3030-2020", status: "Ativo", type: "PJ" },
  { name: "Arquiteta Júlia", email: "julia@arq.com", phone: "(51) 98888-7777", status: "Ativo", type: "PF" },
];

function ClientesTab() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"Todos" | "PJ" | "PF">("Todos");

  const clients = ALL_CLIENTS.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "Todos" || c.type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500 h-full overflow-hidden flex flex-col p-4">
      <div className="flex items-center justify-between mb-3 shrink-0 gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Clientes</h2>
          <p className="text-xs text-gray-500">
            {clients.length} de {ALL_CLIENTS.length} clientes
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* filtro PJ/PF */}
          <div className="flex items-center bg-gray-100 p-0.5 rounded-lg">
            {(["Todos", "PJ", "PF"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${typeFilter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 w-44 bg-white border-gray-200 rounded-full text-xs"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <Button className="bg-brand hover:bg-brand/90 text-ink rounded-full h-8 px-3 text-xs shadow-sm">
            <Plus className="w-3 h-3 mr-1" /> Novo
          </Button>
        </div>
      </div>

      <Card className="flex-1 border-none shadow-sm overflow-hidden flex flex-col min-h-0">
        <table className="w-full text-xs text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-2.5 font-medium text-gray-500">Nome</th>
              <th className="px-4 py-2.5 font-medium text-gray-500 hidden sm:table-cell">Email</th>
              <th className="px-4 py-2.5 font-medium text-gray-500 hidden md:table-cell">Contato</th>
              <th className="px-4 py-2.5 font-medium text-gray-500">Status</th>
              <th className="px-4 py-2.5 font-medium text-gray-500 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {clients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-xs">
                  Nenhum resultado para "{search || typeFilter}"
                </td>
              </tr>
            ) : (
              clients.map((client, i) => (
                <tr key={i} className="group hover:bg-gray-50 transition-colors cursor-pointer">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback
                          className={`text-[10px] font-bold ${client.type === "PJ" ? "text-blue-600 bg-blue-50" : "text-orange-500 bg-orange-50"}`}
                        >
                          {client.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-medium text-gray-900 group-hover:text-brand transition-colors">
                          {client.name}
                        </span>
                        <Badge
                          className={`ml-1.5 border-none text-[8px] font-medium px-1 h-3.5 ${client.type === "PJ" ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-500"}`}
                        >
                          {client.type}
                        </Badge>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell">{client.email}</td>
                  <td className="px-4 py-2.5 text-gray-500 hidden md:table-cell">{client.phone}</td>
                  <td className="px-4 py-2.5">
                    <Badge
                      className={`border-none text-[10px] font-normal ${client.status === "Ativo" ? "bg-green-100 text-green-900" : "bg-gray-100 text-gray-500"}`}
                    >
                      {client.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                        aria-label="Editar"
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-gray-400 hover:text-red-600 hover:bg-red-50"
                        aria-label="Excluir"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="mt-auto px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
          <span className="text-[10px] text-gray-500">
            Mostrando {clients.length} de {ALL_CLIENTS.length} clientes
          </span>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-[10px] px-3" disabled>
              Anterior
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-[10px] px-3">
              Próximo
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── financeiro ──────────────────────────────────────────────────────────────

function FinanceiroTab() {
  const [activeTab, setActiveTab] = useState<"visao" | "fluxo" | "contas">("visao");

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500 h-full overflow-hidden flex flex-col p-4">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Financeiro</h2>
          <p className="text-xs text-gray-500">Controle financeiro em tempo real</p>
        </div>
        <Button className="bg-brand hover:bg-brand/90 text-ink rounded-full text-xs h-8 px-3 shadow-sm">
          <Plus className="w-3 h-3 mr-1" /> Lançamento
        </Button>
      </div>

      <div className="flex gap-0.5 mb-3 bg-gray-100 p-0.5 rounded-lg w-fit shrink-0">
        {(
          [
            ["visao", "Visão Geral"],
            ["fluxo", "Fluxo de Caixa"],
            ["contas", "Contas"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${activeTab === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        {activeTab === "visao" && <FinanceiroVisao />}
        {activeTab === "fluxo" && <FinanceiroFluxo />}
        {activeTab === "contas" && <FinanceiroContas />}
      </div>
    </div>
  );
}

const DONUT_SEGMENTS = [
  { value: 42, color: "#60a5fa", label: "Proj. Residenciais", pct: "42%" },
  { value: 31, color: "#f97316", label: "Proj. Corporativos", pct: "31%" },
  { value: 17, color: "#a78bfa", label: "Consultoria", pct: "17%" },
  { value: 10, color: "#d1d5db", label: "Outros", pct: "10%" },
];

function FinanceiroVisao() {
  return (
    <div className="h-full flex flex-col gap-3 animate-in fade-in duration-300">
      <div className="grid grid-cols-4 gap-3 shrink-0">
        {[
          {
            label: "Receita Mensal",
            value: "R$ 48.250",
            change: "+12%",
            up: true as boolean | null,
            bg: "bg-green-100",
            text: "text-green-800",
            icon: <ArrowUpRight className="h-3.5 w-3.5" />,
            spark: SPARK.receitas,
            sc: "#22c55e",
          },
          {
            label: "Despesas",
            value: "R$ 12.800",
            change: "-5%",
            up: false as boolean | null,
            bg: "bg-red-50",
            text: "text-red-500",
            icon: <ArrowDownRight className="h-3.5 w-3.5" />,
            spark: SPARK.despesas,
            sc: "#ef4444",
          },
          {
            label: "Resultado",
            value: "R$ 35.450",
            change: "+18%",
            up: true as boolean | null,
            bg: "bg-blue-50",
            text: "text-blue-600",
            icon: <TrendingUp className="h-3.5 w-3.5" />,
            spark: SPARK.receitas,
            sc: "#3b82f6",
          },
          {
            label: "Margem",
            value: "73,5%",
            change: "do fat.",
            up: null as boolean | null,
            bg: "bg-orange-50",
            text: "text-brand",
            icon: <Wallet className="h-3.5 w-3.5" />,
            spark: SPARK.projetos,
            sc: "#f97316",
          },
        ].map((k) => (
          <Card key={k.label} className="border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-gray-500 font-medium">{k.label}</span>
                <div className={`p-1.5 rounded-full ${k.bg}`}>
                  <span className={k.text}>{k.icon}</span>
                </div>
              </div>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className={`text-base font-bold ${k.text}`}>{k.value}</div>
                  <p
                    className={`text-[10px] flex items-center mt-0.5 ${k.up === true ? "text-green-800" : k.up === false ? "text-red-500" : "text-gray-400"}`}
                  >
                    {k.up === true && <TrendingUp className="h-2.5 w-2.5 mr-0.5" />}
                    {k.up === false && <TrendingDown className="h-2.5 w-2.5 mr-0.5" />}
                    {k.change}
                  </p>
                </div>
                <Sparkline data={k.spark} color={k.sc} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-3 flex-1 min-h-0">
        {/* donut chart */}
        <Card className="col-span-2 border-none shadow-sm flex flex-col min-h-0">
          <CardHeader className="p-3 pb-1 shrink-0">
            <CardTitle className="text-xs font-semibold text-gray-700">Receitas por Categoria</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 flex items-center gap-4 flex-1">
            <div className="w-20 h-20 shrink-0 relative">
              <DonutChart segments={DONUT_SEGMENTS} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-gray-700">100%</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              {DONUT_SEGMENTS.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5 group cursor-pointer">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-[10px] text-gray-600 flex-1 truncate group-hover:text-gray-900 transition-colors">
                    {s.label}
                  </span>
                  <span className="text-[10px] font-bold text-gray-700">{s.pct}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* lançamentos */}
        <Card className="col-span-3 border-none shadow-sm flex flex-col min-h-0">
          <CardHeader className="p-3 pb-1 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-gray-700">Lançamentos Recentes</CardTitle>
              <button className="text-[10px] text-brand hover:underline">Ver todos</button>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-1 flex flex-col justify-around flex-1">
            {[
              { desc: "Residencial Cascata — Parcela 3", cat: "Receita", value: "+R$ 12.500", date: "Hoje", in: true },
              { desc: "Salários Março", cat: "Folha", value: "-R$ 8.200", date: "Ontem", in: false },
              { desc: "Edifício Horizon — Sinal", cat: "Receita", value: "+R$ 25.000", date: "22 Abr", in: true },
              { desc: "Adobe Creative", cat: "Software", value: "-R$ 340", date: "21 Abr", in: false },
              { desc: "Reforma Shopping — Parcela 2", cat: "Receita", value: "+R$ 18.000", date: "20 Abr", in: true },
            ].map((t, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0 hover:bg-gray-50 px-1 rounded cursor-pointer group transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${t.in ? "bg-green-100" : "bg-red-100"}`}
                  >
                    {t.in ? (
                      <ArrowUpRight className="w-3 h-3 text-green-800" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3 text-red-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-gray-800 group-hover:text-brand transition-colors">
                      {t.desc}
                    </p>
                    <span className="text-[9px] text-gray-400">
                      {t.cat} · {t.date}
                    </span>
                  </div>
                </div>
                <span className={`text-xs font-semibold shrink-0 ${t.in ? "text-green-800" : "text-red-500"}`}>
                  {t.value}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FinanceiroFluxo() {
  const [barsReady, setBarsReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBarsReady(true), 80);
    return () => clearTimeout(t);
  }, []);

  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
  const realizado = [65, 80, 55, 90, 75, 88];
  const projetado = [70, 75, 65, 85, 80, 92];

  return (
    <div className="h-full flex flex-col gap-3 animate-in fade-in duration-300">
      <div className="grid grid-cols-3 gap-3 shrink-0">
        {[
          {
            label: "Saldo Atual",
            value: "R$ 84.320",
            sub: "Em caixa hoje",
            color: "text-green-800",
            bg: "bg-green-100",
          },
          {
            label: "Entrada Prevista",
            value: "R$ 52.000",
            sub: "Próximos 30 dias",
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "Contas a Pagar",
            value: "R$ 14.800",
            sub: "Vence em 30 dias",
            color: "text-red-500",
            bg: "bg-red-50",
          },
        ].map((s) => (
          <Card key={s.label} className="border-none shadow-sm">
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`p-2 rounded-xl ${s.bg}`}>
                <DollarSign className={`w-4 h-4 ${s.color}`} />
              </div>
              <div>
                <p className="text-[10px] text-gray-500">{s.label}</p>
                <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-gray-400">{s.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="flex-1 border-none shadow-sm flex flex-col min-h-0">
        <CardHeader className="p-3 pb-1 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold text-gray-700">Realizado vs Projetado</CardTitle>
            <div className="flex gap-3 text-[10px] text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-brand/80 inline-block" /> Realizado
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-blue-200 inline-block" /> Projetado
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 p-3 pt-1">
          <div className="h-full flex items-end gap-4 pb-4">
            {months.map((m, i) => (
              <div key={m} className="flex-1 flex flex-col justify-end h-full group cursor-pointer">
                <div className="flex-1 flex items-end gap-1">
                  <div className="flex-1 flex flex-col justify-end h-full">
                    <div
                      className="w-full bg-brand/80 rounded-t-sm hover:bg-brand transition-colors relative"
                      style={{
                        height: barsReady ? `${realizado[i]}%` : "0%",
                        transition: `height ${380 + i * 30}ms cubic-bezier(0.16,1,0.3,1)`,
                      }}
                    >
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-0 bg-gray-900 text-white text-[9px] px-2 py-1 rounded-lg whitespace-nowrap pointer-events-none z-10 shadow-lg">
                        <div className="font-semibold text-brand">
                          R$ {(realizado[i] * 600).toLocaleString("pt-BR")}
                        </div>
                        <div className="text-gray-400 text-[8px]">
                          Proj: R$ {(projetado[i] * 600).toLocaleString("pt-BR")}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col justify-end h-full">
                    <div
                      className="w-full bg-blue-200 rounded-t-sm opacity-80"
                      style={{
                        height: barsReady ? `${projetado[i]}%` : "0%",
                        transition: `height ${380 + i * 30}ms cubic-bezier(0.16,1,0.3,1)`,
                      }}
                    />
                  </div>
                </div>
                <span className="text-[9px] text-gray-400 text-center mt-1">{m}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FinanceiroContas() {
  const [tab, setTab] = useState<"receber" | "pagar">("receber");

  const aReceber = [
    { nome: "Edifício Horizon", desc: "Parcela 4/6", valor: "R$ 25.000", vence: "30 Abr", status: "pending" },
    { nome: "Reforma Shopping", desc: "Parcela 3/4", valor: "R$ 45.000", vence: "05 Mai", status: "pending" },
    { nome: "Casa Veraneio", desc: "Entrada", valor: "R$ 18.000", vence: "15 Abr", status: "overdue" },
    { nome: "Interiores 402", desc: "Final", valor: "R$ 8.500", vence: "20 Mai", status: "pending" },
    { nome: "Loja Centro", desc: "Saldo", valor: "R$ 12.000", vence: "Pago", status: "paid" },
  ];
  const aPagar = [
    { nome: "Fornecedores", desc: "Materiais", valor: "R$ 8.200", vence: "28 Abr", status: "pending" },
    { nome: "Folha de Pagamento", desc: "Abril 2024", valor: "R$ 24.500", vence: "05 Mai", status: "pending" },
    { nome: "Adobe / Autodesk", desc: "Licenças", valor: "R$ 1.200", vence: "10 Abr", status: "overdue" },
    { nome: "Aluguel escritório", desc: "Maio 2024", valor: "R$ 3.800", vence: "10 Mai", status: "pending" },
    { nome: "Contador", desc: "Honorários", valor: "R$ 800", vence: "Pago", status: "paid" },
  ];

  const contas = tab === "receber" ? aReceber : aPagar;

  return (
    <div className="h-full flex flex-col gap-3 animate-in fade-in duration-300">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex gap-0.5 bg-gray-100 p-0.5 rounded-lg">
          {(["receber", "pagar"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
            >
              {t === "receber" ? "A Receber" : "A Pagar"}
            </button>
          ))}
        </div>
        <div className="flex gap-3 text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Pendente
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Vencido
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Pago
          </span>
        </div>
      </div>

      <Card className="flex-1 border-none shadow-sm overflow-hidden min-h-0">
        <table className="w-full text-xs text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-2.5 font-medium text-gray-500">{tab === "receber" ? "Cliente" : "Fornecedor"}</th>
              <th className="px-4 py-2.5 font-medium text-gray-500">Descrição</th>
              <th className="px-4 py-2.5 font-medium text-gray-500 text-right">Valor</th>
              <th className="px-4 py-2.5 font-medium text-gray-500">Vencimento</th>
              <th className="px-4 py-2.5 font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {contas.map((c, i) => (
              <tr key={i} className="hover:bg-gray-50 cursor-pointer transition-colors group">
                <td className="px-4 py-2.5 font-medium text-gray-900 group-hover:text-brand transition-colors">
                  {c.nome}
                </td>
                <td className="px-4 py-2.5 text-gray-500">{c.desc}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{c.valor}</td>
                <td className="px-4 py-2.5 text-gray-500">{c.vence}</td>
                <td className="px-4 py-2.5">
                  <Badge
                    className={`border-none text-[10px] font-normal ${c.status === "paid" ? "bg-green-100 text-green-900" : c.status === "overdue" ? "bg-red-100 text-red-600" : "bg-yellow-100 text-yellow-700"}`}
                  >
                    {c.status === "paid" ? "Pago" : c.status === "overdue" ? "Vencido" : "Pendente"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

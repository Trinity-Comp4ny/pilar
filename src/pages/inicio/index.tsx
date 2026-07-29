import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Briefcase, CalendarClock, FolderKanban, HardHat, Plus } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useDashboardData, type DashboardProjeto, type DashboardVencimento } from "@/hooks/useDashboardData";
import { useRecentes } from "@/hooks/useRecentes";
import { usePageTitle } from "@/hooks/usePageTitle";
import { readUltimoModulo, saveUltimoModulo, MODULES, type ModuleId } from "@/lib/modules";
import { ProjectRow } from "./components/ProjectRow";
import { LeadsFunnel } from "./components/LeadsFunnel";
import { CalendarioPreview } from "@/pages/projetos/components/CalendarioPreview";

/** Achado determinístico do Radar (fase 1: queries, zero LLM). */
type Achado = {
  id: string;
  severidade: "critico" | "atencao";
  titulo: string;
  detalhe: string;
  rota: string;
};

function saudacao(nome: string | null): string {
  const h = new Date().getHours();
  const periodo = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  return nome ? `${periodo}, ${nome}` : periodo;
}

function buildAchados(vencimentos: DashboardVencimento[], projetos: DashboardProjeto[]): Achado[] {
  const achados: Achado[] = [];

  for (const v of vencimentos) {
    if (v.status !== "pendente") continue;
    const rota = "/financeiro";
    if (v.diasRestantes < 0) {
      achados.push({
        id: `venc-${v.id}`,
        severidade: "critico",
        titulo: `${v.tipo === "receita" ? "Recebimento" : "Pagamento"} vencido: ${v.descricao}`,
        detalhe: `${formatCurrency(v.valor)} · venceu há ${Math.abs(v.diasRestantes)} dia${Math.abs(v.diasRestantes) === 1 ? "" : "s"}`,
        rota,
      });
    } else if (v.diasRestantes <= 7) {
      achados.push({
        id: `venc-${v.id}`,
        severidade: "atencao",
        titulo: `${v.tipo === "receita" ? "A receber" : "A pagar"}: ${v.descricao}`,
        detalhe:
          v.diasRestantes === 0
            ? `${formatCurrency(v.valor)} · vence hoje`
            : `${formatCurrency(v.valor)} · vence em ${v.diasRestantes} dia${v.diasRestantes === 1 ? "" : "s"}`,
        rota,
      });
    }
  }

  for (const p of projetos) {
    if (p.progressoPrazo >= 100 && !p.dataFinal) {
      achados.push({
        id: `prazo-${p.id}`,
        severidade: "critico",
        titulo: `Prazo estourado: ${p.nome}`,
        detalhe: `${p.cliente} · previsão era ${p.dataPrevisao ? new Date(`${p.dataPrevisao}T00:00:00`).toLocaleDateString("pt-BR") : "sem data"}`,
        rota: `/projetos/${p.id}`,
      });
    }
  }

  // Críticos primeiro, máximo 5 (spec 001, req. 2b).
  return achados.sort((a, b) => (a.severidade === b.severidade ? 0 : a.severidade === "critico" ? -1 : 1)).slice(0, 5);
}

const CHIPS: Array<{ label: string; rota: string; feature: "financeiro" | "projetos" | "propostas" | "leads" }> = [
  { label: "novo lançamento", rota: "/financeiro", feature: "financeiro" },
  { label: "novo projeto", rota: "/projetos", feature: "projetos" },
  { label: "nova proposta", rota: "/documentos", feature: "propostas" },
  { label: "novo lead", rota: "/leads", feature: "leads" },
];

export default function Inicio() {
  usePageTitle("Início");
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { can } = usePermissions();
  const { recentes } = useRecentes();
  const { data, isLoading } = useDashboardData();
  const [pergunta, setPergunta] = useState("");

  const primeiroNome = profile?.first_name || null;
  const ultimoModulo = readUltimoModulo();

  const achados = useMemo(() => (data ? buildAchados(data.proximosVencimentos, data.projetos) : []), [data]);

  const projetosAtrasados = useMemo(
    () => (data ? data.projetos.filter((p) => p.progressoPrazo >= 100 && !p.dataFinal).length : 0),
    [data]
  );

  const perguntar = () => {
    const prompt = pergunta.trim();
    navigate("/agentes", prompt ? { state: { prompt } } : undefined);
  };

  const abrirModulo = (id: ModuleId) => {
    saveUltimoModulo(id);
    navigate(MODULES[id].homeRoute);
  };

  const podeFinanceiro = can("financeiro");
  const podeProjetos = can("projetos") || can("dashboard");
  const podeAgentes = can("ai_chat");

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Saudação + herói: o input É o agente (busca ou ação) */}
      <h1 className="text-2xl font-semibold tracking-tight text-ink mb-6">{saudacao(primeiroNome)}</h1>

      {podeAgentes && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              perguntar();
            }}
            className="flex items-center gap-3 rounded-full border border-black/10 bg-white pl-5 pr-2 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-brand/60"
          >
            <input
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              placeholder="Pergunte, busque ou peça uma ação"
              className="flex-1 bg-transparent text-[15px] text-ink placeholder:text-black/40 outline-none py-2.5"
              aria-label="Perguntar aos agentes"
            />
            <button
              type="submit"
              className="h-9 w-9 rounded-full bg-brand text-ink grid place-items-center hover:opacity-90 transition-opacity"
              aria-label="Enviar para os agentes"
            >
              <ArrowRight size={16} />
            </button>
          </form>
          <p className="text-xs text-black/40 mt-2 px-2">
            Enter envia para os agentes. Exemplos: "quanto recebi esse mês?", "cadastrar lead João"
          </p>
        </>
      )}

      {/* Ações rápidas */}
      <div className="flex flex-wrap gap-2 mt-5 mb-10">
        {CHIPS.filter((c) => can(c.feature)).map((c) => (
          <button
            key={c.label}
            onClick={() => navigate(c.rota)}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-[13px] text-ink/80 hover:bg-brand/20 transition-colors"
          >
            <Plus size={13} /> {c.label}
          </button>
        ))}
      </div>

      {/* Radar: achados determinísticos apresentados como descobertas dos agentes */}
      <section className="mb-10" aria-label="Radar">
        <h2 className="text-[10px] font-medium uppercase tracking-[0.08em] text-black/40 mb-2.5">Radar dos agentes</h2>
        {isLoading ? (
          <div className="rounded-2xl border border-black/10 bg-white px-5 py-4 text-sm text-black/40">
            Verificando vencimentos e prazos...
          </div>
        ) : achados.length === 0 ? (
          <div className="rounded-2xl border border-black/10 bg-white px-5 py-4 text-sm text-black/50">
            Nenhum alerta. Vencimentos e prazos em dia.
          </div>
        ) : (
          <div className="rounded-2xl border border-black/10 bg-white divide-y divide-black/5 overflow-hidden">
            {achados.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(a.rota)}
                className="w-full flex items-start gap-3 px-5 py-3.5 text-left hover:bg-black/[0.02] transition-colors"
              >
                {a.severidade === "critico" ? (
                  <AlertTriangle size={16} className="text-destructive mt-0.5 shrink-0" />
                ) : (
                  <CalendarClock size={16} className="text-black/45 mt-0.5 shrink-0" />
                )}
                <span className="min-w-0">
                  <span className="block text-sm text-ink truncate">{a.titulo}</span>
                  <span className="block text-xs text-black/45 mt-0.5">{a.detalhe}</span>
                </span>
                <ArrowRight size={14} className="ml-auto mt-1 text-black/25 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Módulos */}
      <section className="mb-10" aria-label="Módulos">
        <h2 className="text-[10px] font-medium uppercase tracking-[0.08em] text-black/40 mb-2.5">Módulos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {podeFinanceiro && (
            <button
              onClick={() => abrirModulo("gestao")}
              className={cn(
                "rounded-2xl border bg-white p-4 text-left hover:shadow-sm transition-shadow",
                ultimoModulo === "gestao" ? "border-brand border-[1.5px]" : "border-black/10"
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Briefcase size={15} /> Gestão
              </span>
              <span className="block text-[13px] text-black/55 mt-2 tabular-nums">
                {data ? `${formatCurrency(data.kpis.aPagar)} a pagar` : "..."}
              </span>
            </button>
          )}
          {podeProjetos && (
            <button
              onClick={() => abrirModulo("projetos")}
              className={cn(
                "rounded-2xl border bg-white p-4 text-left hover:shadow-sm transition-shadow",
                ultimoModulo === "projetos" ? "border-brand border-[1.5px]" : "border-black/10"
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                <FolderKanban size={15} /> Projetos
              </span>
              <span className="block text-[13px] text-black/55 mt-2 tabular-nums">
                {data
                  ? `${data.kpis.projetosAtivos} ativos${projetosAtrasados > 0 ? ` · ${projetosAtrasados} com prazo estourado` : ""}`
                  : "..."}
              </span>
            </button>
          )}
          <button
            onClick={() => abrirModulo("obras")}
            className="rounded-2xl border border-black/10 bg-white p-4 text-left opacity-75 hover:opacity-100 transition-opacity"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-ink">
              <HardHat size={15} /> Obras
              <span className="ml-auto text-[9.5px] font-medium uppercase tracking-wide rounded-full bg-black/5 text-black/50 px-2 py-0.5">
                em breve
              </span>
            </span>
            <span className="block text-[13px] text-black/55 mt-2">Antecipe o que vai parar a obra</span>
          </button>
        </div>
      </section>

      {/* Projetos ativos (operacional, vindo do antigo Dashboard) */}
      {podeProjetos && data && data.projetos.length > 0 && (
        <section className="mb-10" aria-label="Projetos ativos">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-[10px] font-medium uppercase tracking-[0.08em] text-black/40">Projetos ativos</h2>
            <button
              onClick={() => navigate("/projetos")}
              className="text-xs text-black/45 hover:text-ink transition-colors"
            >
              Ver todos
            </button>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white p-1.5 divide-y divide-black/5">
            {data.projetos.slice(0, 5).map((p) => (
              <ProjectRow key={p.id} project={p} onClick={() => navigate(`/projetos/${p.id}`)} />
            ))}
          </div>
        </section>
      )}

      {/* Calendário de prazos */}
      {podeProjetos && (
        <section className="mb-10" aria-label="Calendário de prazos">
          <CalendarioPreview />
        </section>
      )}

      {/* Pipeline de leads */}
      {can("leads") && data && data.leadsTotal > 0 && (
        <section className="mb-10" aria-label="Pipeline de leads">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-[10px] font-medium uppercase tracking-[0.08em] text-black/40">Pipeline de leads</h2>
            <button
              onClick={() => navigate("/leads")}
              className="text-xs text-black/45 hover:text-ink transition-colors"
            >
              Ver todos
            </button>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white px-5 py-4">
            <LeadsFunnel pipeline={data.leadsPipeline} total={data.leadsTotal} />
          </div>
        </section>
      )}

      {/* Recentes */}
      <section aria-label="Recentes">
        <h2 className="text-[10px] font-medium uppercase tracking-[0.08em] text-black/40 mb-2.5">Recentes</h2>
        {recentes.length === 0 ? (
          <p className="text-sm text-black/40">Suas últimas páginas e registros visitados aparecem aqui.</p>
        ) : (
          <div className="flex flex-col">
            {recentes.map((r) => (
              <button
                key={r.rota}
                onClick={() => navigate(r.rota)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-black/[0.03] transition-colors"
              >
                <span className="w-20 shrink-0 text-[10px] uppercase tracking-wide text-black/40">{r.tipo}</span>
                <span className="text-sm text-ink/85 truncate">{r.label}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

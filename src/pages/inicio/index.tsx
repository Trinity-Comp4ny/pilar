import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, CalendarClock, CloudRain, Sparkles, Wind } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { analytics } from "@/lib/analytics";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useDashboardData, type DashboardProjeto, type DashboardVencimento } from "@/hooks/useDashboardData";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAlertasClimaObras } from "@/hooks/useAlertasClima";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { KPICard } from "@/components/KPICard";
import { DataFrescor } from "@/components/DataFrescor";
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

/** KPI da faixa de dados (spec 011). `tone` colore o número; `subtitle` é a linha de risco. */
type KpiDef = {
  label: string;
  value: string | number;
  tone: "positive" | "danger" | "neutral";
  subtitle?: string;
  subtitleTone?: "muted" | "positive" | "danger";
  delta?: { value?: number; isNew?: boolean };
  rota?: string;
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

// Grid da faixa de KPIs adaptado à quantidade (a tela se molda aos módulos ativos).
function kpiGridCols(n: number): string {
  if (n <= 2) return "grid-cols-2";
  if (n === 3) return "grid-cols-2 sm:grid-cols-3";
  if (n === 4) return "grid-cols-2 lg:grid-cols-4";
  return "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5";
}

export default function Inicio() {
  usePageTitle("Início");
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { can } = usePermissions();
  const { data, isLoading, isFetching, dataUpdatedAt, refetch } = useDashboardData();
  const [pergunta, setPergunta] = useState("");

  const primeiroNome = profile?.first_name || null;

  const achados = useMemo(() => (data ? buildAchados(data.proximosVencimentos, data.projetos) : []), [data]);

  const projetosAtrasados = useMemo(
    () => (data ? data.projetos.filter((p) => p.progressoPrazo >= 100 && !p.dataFinal).length : 0),
    [data]
  );

  // Vencido = o que o sócio precisa ver separado do total "a pagar/a receber" (lente do ICP).
  const vencido = useMemo(() => {
    let receber = 0;
    let pagar = 0;
    for (const v of data?.proximosVencimentos ?? []) {
      if (v.status !== "pendente" || v.diasRestantes >= 0) continue;
      if (v.tipo === "receita") receber += v.valor;
      else pagar += v.valor;
    }
    return { receber, pagar };
  }, [data]);

  const podeFinanceiro = can("financeiro");
  const podeProjetos = can("projetos") || can("dashboard");
  const podeAgentes = can("ai_chat");
  const podeObras = can("obras");
  const { alertas: alertasClima } = useAlertasClimaObras(podeObras);

  // Faixa de KPIs: monta só o que os módulos da empresa habilitam.
  const kpis = useMemo<KpiDef[]>(() => {
    if (!data) return [];
    const out: KpiDef[] = [];
    const k = data.kpis;
    if (podeFinanceiro) {
      out.push({
        label: "Saldo do mês",
        value: k.saldoMes,
        tone: k.saldoMes < 0 ? "danger" : "positive",
        subtitle: `${formatCurrency(k.receitaMes)} entrou · ${formatCurrency(k.despesaMes)} saiu`,
        rota: "/financeiro",
      });
      out.push({
        label: "Recebido no mês",
        value: k.receitaMes,
        tone: "positive",
        delta: { value: k.receitaNovo ? undefined : k.receitaVariacao, isNew: k.receitaNovo },
        rota: "/financeiro",
      });
      out.push({
        label: "A receber",
        value: k.aReceber,
        tone: "positive",
        subtitle: vencido.receber > 0 ? `${formatCurrency(vencido.receber)} vencido` : "nada vencido",
        subtitleTone: vencido.receber > 0 ? "danger" : "muted",
        rota: "/financeiro",
      });
      out.push({
        label: "A pagar",
        value: k.aPagar,
        tone: "danger",
        subtitle: vencido.pagar > 0 ? `${formatCurrency(vencido.pagar)} vencido` : "nada vencido",
        subtitleTone: vencido.pagar > 0 ? "danger" : "muted",
        rota: "/financeiro",
      });
    }
    if (podeProjetos) {
      out.push({
        label: "Projetos ativos",
        value: String(k.projetosAtivos),
        tone: "neutral",
        subtitle: projetosAtrasados > 0 ? `${projetosAtrasados} com prazo estourado` : "prazos em dia",
        subtitleTone: projetosAtrasados > 0 ? "danger" : "muted",
        rota: "/projetos",
      });
    }
    return out;
  }, [data, podeFinanceiro, podeProjetos, projetosAtrasados, vencido]);

  // Rótulos estáticos p/ o esqueleto de carregamento (não dependem de dados).
  const loadingLabels = useMemo<string[]>(
    () => [
      ...(podeFinanceiro ? ["Saldo do mês", "Recebido no mês", "A receber", "A pagar"] : []),
      ...(podeProjetos ? ["Projetos ativos"] : []),
    ],
    [podeFinanceiro, podeProjetos]
  );

  const perguntar = () => {
    const prompt = pergunta.trim();
    // Instrumenta a porta de entrada do agente (não envia o texto: PII). Spec 001 pedia medir isto.
    analytics.track("inicio_agentes_abrir", { origem: "barra_inicio", com_texto: prompt.length > 0 });
    navigate("/agentes", prompt ? { state: { prompt } } : undefined);
  };

  return (
    <PageLayout
      header={
        <PageHeader title="Início">
          <DataFrescor updatedAt={dataUpdatedAt} isFetching={isFetching} onRefresh={() => void refetch()} />
        </PageHeader>
      }
    >
      {/* Saudação enxuta + faixa de KPIs: o número é o herói da primeira dobra (voto do time + ICP). */}
      <section aria-label="Indicadores" className="pt-1">
        <p className="text-sm text-ink-muted mb-4">{saudacao(primeiroNome)}</p>
        {isLoading && !data ? (
          loadingLabels.length > 0 && (
            <div className={cn("grid gap-3", kpiGridCols(loadingLabels.length))}>
              {loadingLabels.map((label) => (
                <KPICard key={label} label={label} value="" loading />
              ))}
            </div>
          )
        ) : kpis.length > 0 ? (
          <div className={cn("grid gap-3", kpiGridCols(kpis.length))}>
            {kpis.map((kpi) => (
              <KPICard
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
                tone={kpi.tone}
                subtitle={kpi.subtitle}
                subtitleTone={kpi.subtitleTone}
                delta={kpi.delta}
                onClick={kpi.rota ? () => navigate(kpi.rota!) : undefined}
              />
            ))}
          </div>
        ) : null}
      </section>

      {/* Porta para os agentes, com destaque. A conversa mora em /agentes, não aqui. */}
      {podeAgentes && (
        <section aria-label="Assistente">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              perguntar();
            }}
            className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white pl-4 pr-2.5 py-3 shadow-lg focus-within:ring-2 focus-within:ring-brand/60"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-ink">
              <Sparkles size={20} />
            </span>
            <input
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              placeholder="Pergunte aos agentes"
              className="flex-1 bg-transparent text-lg text-ink placeholder:text-ink-muted outline-none py-1.5"
              aria-label="Perguntar aos agentes"
            />
            <button
              type="submit"
              className="h-12 w-12 shrink-0 rounded-xl bg-brand text-ink grid place-items-center hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
              aria-label="Abrir conversa com os agentes"
            >
              <ArrowRight size={20} />
            </button>
          </form>
          <p className="text-xs text-ink-muted mt-2">
            Enter abre a conversa nos agentes. Ex.: "quanto recebi esse mês?", "projetos com prazo estourado"
          </p>
        </section>
      )}

      {/* Operacional em duas colunas nas telas grandes: ação/risco à esquerda, contexto à direita */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 space-y-6">
          {/* Radar: alertas primeiro, é o que pede ação */}
          <section aria-label="Radar">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted mb-2.5">
              Radar dos agentes
            </h2>
            {isLoading ? (
              <div className="rounded-2xl border border-black/10 bg-white px-5 py-4 text-sm text-ink-muted">
                Verificando vencimentos e prazos...
              </div>
            ) : achados.length === 0 ? (
              <div className="flex items-center gap-2.5 rounded-2xl border border-positive/40 bg-positive/5 px-5 py-4 text-sm text-ink-soft">
                <CalendarClock size={16} className="text-positive-strong shrink-0" />
                Nada crítico hoje. Vencimentos e prazos em dia.
              </div>
            ) : (
              <div className="rounded-2xl border border-black/10 bg-white divide-y divide-black/5 overflow-hidden">
                {achados.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => navigate(a.rota)}
                    className="w-full flex items-start gap-3 px-5 py-3.5 text-left hover:bg-black/[0.02] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
                  >
                    {a.severidade === "critico" ? (
                      <AlertTriangle size={16} className="text-negative-strong mt-0.5 shrink-0" />
                    ) : (
                      <CalendarClock size={16} className="text-ink-muted mt-0.5 shrink-0" />
                    )}
                    <span className="min-w-0">
                      <span className="block text-sm text-ink truncate">{a.titulo}</span>
                      <span className="block text-xs text-ink-soft mt-0.5">{a.detalhe}</span>
                    </span>
                    <ArrowRight size={14} className="ml-auto mt-1 text-ink-muted shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Clima das obras: chuva ou vento forte hoje/amanhã (só se houver alerta) */}
          {podeObras && alertasClima.length > 0 && (
            <section aria-label="Clima das obras">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted mb-2.5">
                Clima das obras
              </h2>
              <div className="rounded-2xl border border-black/10 bg-white divide-y divide-black/5 overflow-hidden">
                {alertasClima.map((a) => (
                  <button
                    key={`${a.obraId}-${a.tipo}`}
                    onClick={() => navigate("/obras/clima")}
                    className="w-full flex items-start gap-3 px-5 py-3.5 text-left hover:bg-black/[0.02] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
                  >
                    {a.tipo === "chuva" ? (
                      <CloudRain size={16} className="text-info-strong mt-0.5 shrink-0" />
                    ) : (
                      <Wind size={16} className="text-attention-strong mt-0.5 shrink-0" />
                    )}
                    <span className="min-w-0">
                      <span className="block text-sm text-ink truncate">
                        {a.obraNome}
                        {a.cidade ? ` · ${a.cidade}` : ""}
                      </span>
                      <span className="block text-xs text-ink-soft mt-0.5 first-letter:uppercase">{a.label}</span>
                    </span>
                    <ArrowRight size={14} className="ml-auto mt-1 text-ink-muted shrink-0" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Projetos ativos (operacional, vindo do antigo Dashboard) */}
          {podeProjetos && data && data.projetos.length > 0 && (
            <section aria-label="Projetos ativos">
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">Projetos ativos</h2>
                <button
                  onClick={() => navigate("/projetos")}
                  className="rounded px-1.5 py-1 text-xs text-ink-muted hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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

          {/* Pipeline de leads */}
          {can("leads") && data && data.leadsTotal > 0 && (
            <section aria-label="Pipeline de leads">
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">
                  Pipeline de leads
                </h2>
                <button
                  onClick={() => navigate("/gestao/leads")}
                  className="rounded px-1.5 py-1 text-xs text-ink-muted hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  Ver todos
                </button>
              </div>
              <div className="rounded-2xl border border-black/10 bg-white px-5 py-4">
                <LeadsFunnel pipeline={data.leadsPipeline} total={data.leadsTotal} />
              </div>
            </section>
          )}
        </div>

        {/* Calendário de prazos */}
        {podeProjetos && (
          <aside>
            <section aria-label="Calendário de prazos">
              <CalendarioPreview />
            </section>
          </aside>
        )}
      </div>
    </PageLayout>
  );
}

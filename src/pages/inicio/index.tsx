import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowRight, CalendarClock, CloudRain, EyeOff, Monitor, Sparkles, Wind } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { analytics } from "@/lib/analytics";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useDashboardData, type DashboardProjeto, type DashboardVencimento } from "@/hooks/useDashboardData";
import { usePainelGestao } from "@/hooks/usePainelGestao";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAlertasClimaObras } from "@/hooks/useAlertasClima";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { KPICard } from "@/components/KPICard";
import { DataFrescor } from "@/components/DataFrescor";
import { ProjectRow } from "./components/ProjectRow";
import { CalendarioPreview } from "@/pages/projetos/components/CalendarioPreview";
import { SecaoComercial, SecaoProdutividade, SecaoProjetos, type Cena } from "./components/painel/PainelSecoes";

/**
 * /inicio: painel de gestão da empresa (SPEC 092, ADR 0037).
 *
 * A tela responde quatro perguntas de sócio (vendemos? entregamos no prazo? o
 * escritório rende? onde vamos mal?) e NÃO exibe dado financeiro em nenhuma das
 * três seções: receita, custo, margem e caixa seguem no Financeiro, que tem eixo
 * de acesso próprio (ADR 0034). Por isso o painel serve a qualquer papel e pode
 * ficar numa TV do escritório.
 *
 * O Radar abaixo é a exceção declarada: é bloco de AÇÃO, não indicador, e a
 * parte de vencimento (que mostra valor) só é montada para quem passa em
 * `financeiro`.
 */

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

function buildAchados(
  vencimentos: DashboardVencimento[],
  projetos: DashboardProjeto[],
  money: (value: number) => string,
  podeFinanceiro: boolean
): Achado[] {
  const achados: Achado[] = [];

  // Vencimento carrega valor: só entra para quem pode ver dinheiro (ADR 0034).
  if (podeFinanceiro) {
    for (const v of vencimentos) {
      if (v.status !== "pendente") continue;
      const rota = "/financeiro";
      if (v.diasRestantes < 0) {
        achados.push({
          id: `venc-${v.id}`,
          severidade: "critico",
          titulo: `${v.tipo === "receita" ? "Recebimento" : "Pagamento"} vencido: ${v.descricao}`,
          detalhe: `${money(v.valor)} · venceu há ${Math.abs(v.diasRestantes)} dia${Math.abs(v.diasRestantes) === 1 ? "" : "s"}`,
          rota,
        });
      } else if (v.diasRestantes <= 7) {
        achados.push({
          id: `venc-${v.id}`,
          severidade: "atencao",
          titulo: `${v.tipo === "receita" ? "A receber" : "A pagar"}: ${v.descricao}`,
          detalhe:
            v.diasRestantes === 0
              ? `${money(v.valor)} · vence hoje`
              : `${money(v.valor)} · vence em ${v.diasRestantes} dia${v.diasRestantes === 1 ? "" : "s"}`,
          rota,
        });
      }
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

const CENAS: { key: Cena; label: string }[] = [
  { key: "comercial", label: "Comercial" },
  { key: "projetos", label: "Projetos" },
  { key: "produtividade", label: "Produtividade" },
  { key: "tudo", label: "Tudo" },
];

/** Rotação do modo TV: 20 s por cena (SPEC 092, requisito 6). */
const ROTACAO: Cena[] = ["comercial", "projetos", "produtividade"];
const INTERVALO_CENA_MS = 20_000;

export default function Inicio() {
  usePageTitle("Início");
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { can } = usePermissions();
  const [searchParams] = useSearchParams();
  const modoTv = searchParams.get("tv") === "1";

  const { data, isLoading, isFetching, dataUpdatedAt, refetch } = useDashboardData();
  const formatCurrency = useMoneyMask();

  const podeFinanceiro = can("financeiro");
  const podeProjetos = can("projetos") || can("dashboard");
  const podeComercial = can("propostas") || can("leads");
  const podeAgentes = can("ai_chat");
  const podeObras = can("obras");
  const { alertas: alertasClima } = useAlertasClimaObras(podeObras);

  const painel = usePainelGestao(podeProjetos || podeComercial);

  const [pergunta, setPergunta] = useState("");
  const [cena, setCena] = useState<Cena>(modoTv ? ROTACAO[0] : "tudo");
  // Na parede do escritório o painel não expõe nome de pessoa (ADR 0037).
  const [ocultarNomes, setOcultarNomes] = useState(modoTv);

  // Rotação automática das cenas em modo TV.
  useEffect(() => {
    if (!modoTv) return;
    let i = 0;
    const timer = window.setInterval(() => {
      i = (i + 1) % ROTACAO.length;
      setCena(ROTACAO[i]);
    }, INTERVALO_CENA_MS);
    return () => window.clearInterval(timer);
  }, [modoTv]);

  const primeiroNome = profile?.first_name || null;

  const achados = useMemo(
    () => (data ? buildAchados(data.proximosVencimentos, data.projetos, formatCurrency, podeFinanceiro) : []),
    [data, formatCurrency, podeFinanceiro]
  );

  const perguntar = () => {
    const prompt = pergunta.trim();
    // Instrumenta a porta de entrada do agente (não envia o texto: PII). Spec 001 pedia medir isto.
    analytics.track("inicio_agentes_abrir", { origem: "barra_inicio", com_texto: prompt.length > 0 });
    navigate("/agentes", prompt ? { state: { prompt } } : undefined);
  };

  const p = painel.data;
  const a = p?.ancoras;

  const mostra = (c: Cena) => cena === "tudo" || cena === c;

  return (
    <PageLayout
      header={
        modoTv ? undefined : (
          <PageHeader title="Início">
            <DataFrescor updatedAt={dataUpdatedAt} isFetching={isFetching} onRefresh={() => void refetch()} />
          </PageHeader>
        )
      }
    >
      {/* zoom escala a tela inteira de uma vez para leitura a distância, sem
          duplicar escala tipográfica em cada bloco. */}
      <div style={modoTv ? { zoom: 1.3 } : undefined} className="flex flex-col gap-6">
        {/* Faixa de controle: cenas, privacidade de nome e entrada do modo TV. */}
        <section aria-label="Indicadores" className="flex flex-col gap-3 pt-1">
          {!modoTv && <p className="text-sm text-ink-muted">{saudacao(primeiroNome)}</p>}

          <div className="flex flex-wrap items-center gap-2">
            {!modoTv && (
              <nav aria-label="Cenas do painel" className="flex flex-wrap gap-1">
                {CENAS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={cena === c.key}
                    onClick={() => setCena(c.key)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                      cena === c.key
                        ? "border-black/10 bg-white text-ink shadow-sm"
                        : "border-transparent text-ink-muted hover:bg-black/5 hover:text-ink"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </nav>
            )}

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={ocultarNomes}
                onClick={() => setOcultarNomes((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  ocultarNomes ? "border-brand bg-brand text-ink" : "border-black/10 bg-white text-ink-soft hover:bg-black/5"
                )}
              >
                <EyeOff size={13} />
                {ocultarNomes ? "Nomes ocultos" : "Ocultar nomes"}
              </button>
              {!modoTv && (
                <a
                  href="/inicio?tv=1"
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <Monitor size={13} />
                  Modo TV
                </a>
              )}
            </div>
          </div>

          {/* Âncoras: o KPICard do design system, com número em tinta (TONE_VALUE:
              só dinheiro colore, e aqui não há dinheiro). */}
          {painel.isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {["Conversão", "Entrega no prazo", "Concluídas na semana", "Desvio de horas", "Na mão do cliente"].map(
                (label) => (
                  <KPICard key={label} label={label} value="" loading />
                )
              )}
            </div>
          ) : painel.isError ? (
            <div className="rounded-2xl border border-danger-soft-border bg-danger-soft px-4 py-3 text-sm text-danger-strong">
              Não foi possível carregar os indicadores.{" "}
              <button type="button" onClick={() => void painel.refetch()} className="underline">
                Tentar de novo
              </button>
            </div>
          ) : a ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <KPICard
                label="Conversão de propostas"
                value={a.conversao.valor === null ? "sem decisão" : `${a.conversao.valor}%`}
                subtitle={
                  a.conversao.anterior === null
                    ? `${a.conversao.decididas} decididas em 90 dias`
                    : `de ${a.conversao.anterior}% nos 90 dias anteriores`
                }
                subtitleTone={
                  a.conversao.valor !== null && a.conversao.anterior !== null
                    ? a.conversao.valor >= a.conversao.anterior
                      ? "positive"
                      : "danger"
                    : "muted"
                }
                onClick={() => navigate("/gestao/propostas")}
              />
              <KPICard
                label="Entrega no prazo"
                value={a.prazo.valor === null ? "sem histórico" : `${a.prazo.valor}%`}
                subtitle={
                  a.prazo.anterior === null
                    ? "concluídos nos últimos 6 meses"
                    : `de ${a.prazo.anterior}% no semestre anterior`
                }
                subtitleTone={
                  a.prazo.valor !== null && a.prazo.anterior !== null
                    ? a.prazo.valor >= a.prazo.anterior
                      ? "positive"
                      : "danger"
                    : "muted"
                }
                onClick={() => navigate("/projetos")}
              />
              <KPICard
                label="Tarefas concluídas"
                value={String(a.concluidasSemana.valor)}
                delta={
                  a.concluidasSemana.media && a.concluidasSemana.media > 0
                    ? {
                        value: Math.round(
                          ((a.concluidasSemana.valor - a.concluidasSemana.media) / a.concluidasSemana.media) * 100
                        ),
                      }
                    : undefined
                }
                subtitle={
                  a.concluidasSemana.media === null
                    ? "esta semana"
                    : `esta semana, média de ${a.concluidasSemana.media}`
                }
                onClick={() => navigate("/gestao/tarefas")}
              />
              <KPICard
                label="Desvio de horas"
                value={a.desvioHoras.valor === null ? "sem estimativa" : `${a.desvioHoras.valor > 0 ? "+" : ""}${a.desvioHoras.valor}%`}
                subtitle="contra o estimado, projetos ativos"
                subtitleTone={a.desvioHoras.valor !== null && a.desvioHoras.valor > 0 ? "danger" : "muted"}
                onClick={() => navigate("/projetos")}
              />
              <KPICard
                label="Na mão do cliente"
                value={String(a.aguardandoCliente.valor)}
                subtitle={
                  a.aguardandoCliente.parados > 0
                    ? `${a.aguardandoCliente.parados} esperando há mais de 30 dias`
                    : "propostas enviadas sem decisão"
                }
                subtitleTone={a.aguardandoCliente.parados > 0 ? "danger" : "muted"}
                onClick={() => navigate("/gestao/propostas")}
              />
            </div>
          ) : null}
        </section>

        {/* As três seções do painel. Nenhuma exibe dinheiro. */}
        {p && (
          <div className="flex flex-col gap-6">
            {podeComercial && mostra("comercial") && <SecaoComercial data={p} />}
            {podeProjetos && mostra("projetos") && <SecaoProjetos data={p} ocultarNomes={ocultarNomes} />}
            {podeProjetos && mostra("produtividade") && (
              <SecaoProdutividade data={p} ocultarNomes={ocultarNomes} />
            )}
          </div>
        )}

        {/* Cobertura: o que o painel não sabe, para o número não parecer completo. */}
        {p && !modoTv && (
          <section aria-label="Cobertura dos dados" className="flex flex-col gap-2">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">
              Cobertura dos dados
            </h2>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {p.cobertura.desde && (
                <span className="rounded-xl border border-black/10 bg-white px-3 py-2">
                  Histórico desde{" "}
                  <b className="font-semibold text-ink">
                    {new Date(`${p.cobertura.desde}T00:00:00`).toLocaleDateString("pt-BR", {
                      month: "long",
                      year: "numeric",
                    })}
                  </b>
                </span>
              )}
              {p.cobertura.projetosSemPrazo > 0 && (
                <span className="rounded-xl border border-black/10 bg-white px-3 py-2">
                  <b className="font-semibold text-ink">{p.cobertura.projetosSemPrazo}</b> projeto
                  {p.cobertura.projetosSemPrazo === 1 ? "" : "s"} sem data de previsão, fora do cálculo de prazo
                </span>
              )}
              {p.cobertura.propostasSemHistorico > 0 && (
                <span className="rounded-xl border border-black/10 bg-white px-3 py-2">
                  <b className="font-semibold text-ink">{p.cobertura.propostasSemHistorico}</b> proposta
                  {p.cobertura.propostasSemHistorico === 1 ? "" : "s"} sem data de envio registrada
                </span>
              )}
              {p.cobertura.leadsSemMotivoPadrao > 0 && (
                <span className="rounded-xl border border-black/10 bg-white px-3 py-2">
                  <b className="font-semibold text-ink">{p.cobertura.leadsSemMotivoPadrao}</b> lead
                  {p.cobertura.leadsSemMotivoPadrao === 1 ? "" : "s"} perdido
                  {p.cobertura.leadsSemMotivoPadrao === 1 ? "" : "s"} com motivo fora do padrão
                </span>
              )}
            </div>
          </section>
        )}

        {/* Ação e atalho: o que a tela já tinha, agora no rodapé (ADR 0037). */}
        {!modoTv && (
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              <section aria-label="Radar">
                <h2 className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">
                  Radar dos agentes
                </h2>
                {isLoading ? (
                  <div className="rounded-2xl border border-black/10 bg-white px-5 py-4 text-sm text-ink-muted">
                    Verificando prazos{podeFinanceiro ? " e vencimentos" : ""}...
                  </div>
                ) : achados.length === 0 ? (
                  <div className="flex items-center gap-2.5 rounded-2xl border border-positive/40 bg-positive/5 px-5 py-4 text-sm text-ink-soft">
                    <CalendarClock size={16} className="shrink-0 text-positive-strong" />
                    Nada crítico hoje. Prazos{podeFinanceiro ? " e vencimentos" : ""} em dia.
                  </div>
                ) : (
                  <div className="divide-y divide-black/5 overflow-hidden rounded-2xl border border-black/10 bg-white">
                    {achados.map((achado) => (
                      <button
                        key={achado.id}
                        onClick={() => navigate(achado.rota)}
                        className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
                      >
                        {achado.severidade === "critico" ? (
                          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-negative-strong" />
                        ) : (
                          <CalendarClock size={16} className="mt-0.5 shrink-0 text-ink-muted" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-ink">{achado.titulo}</span>
                          <span className="mt-0.5 block text-xs text-ink-soft">{achado.detalhe}</span>
                        </span>
                        <ArrowRight size={14} className="ml-auto mt-1 shrink-0 text-ink-muted" />
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {podeObras && alertasClima.length > 0 && (
                <section aria-label="Clima das obras">
                  <h2 className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">
                    Clima das obras
                  </h2>
                  <div className="divide-y divide-black/5 overflow-hidden rounded-2xl border border-black/10 bg-white">
                    {alertasClima.map((alerta) => (
                      <button
                        key={`${alerta.obraId}-${alerta.tipo}`}
                        onClick={() => navigate("/obras/clima")}
                        className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
                      >
                        {alerta.tipo === "chuva" ? (
                          <CloudRain size={16} className="mt-0.5 shrink-0 text-info-strong" />
                        ) : (
                          <Wind size={16} className="mt-0.5 shrink-0 text-attention-strong" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-ink">
                            {alerta.obraNome}
                            {alerta.cidade ? ` · ${alerta.cidade}` : ""}
                          </span>
                          <span className="mt-0.5 block text-xs text-ink-soft first-letter:uppercase">
                            {alerta.label}
                          </span>
                        </span>
                        <ArrowRight size={14} className="ml-auto mt-1 shrink-0 text-ink-muted" />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {podeAgentes && (
                <section aria-label="Assistente">
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      perguntar();
                    }}
                    className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white py-3 pl-4 pr-2.5 shadow-lg focus-within:ring-2 focus-within:ring-brand/60"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-ink">
                      <Sparkles size={20} />
                    </span>
                    <input
                      value={pergunta}
                      onChange={(event) => setPergunta(event.target.value)}
                      placeholder="Pergunte aos agentes"
                      className="flex-1 bg-transparent py-1.5 text-lg text-ink outline-none placeholder:text-ink-muted"
                      aria-label="Perguntar aos agentes"
                    />
                    <button
                      type="submit"
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand text-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                      aria-label="Abrir conversa com os agentes"
                    >
                      <ArrowRight size={20} />
                    </button>
                  </form>
                  <p className="mt-2 text-xs text-ink-muted">
                    Enter abre a conversa nos agentes. Ex.: "projetos com prazo estourado", "quem está com mais
                    disciplina atrasada"
                  </p>
                </section>
              )}

              {podeProjetos && data && data.projetos.length > 0 && (
                <section aria-label="Projetos ativos">
                  <div className="mb-2.5 flex items-center justify-between">
                    <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">
                      Projetos ativos
                    </h2>
                    <button
                      onClick={() => navigate("/projetos")}
                      className="rounded px-1.5 py-1 text-xs text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      Ver todos
                    </button>
                  </div>
                  <div className="divide-y divide-black/5 rounded-2xl border border-black/10 bg-white p-1.5">
                    {data.projetos.slice(0, 5).map((projeto) => (
                      <ProjectRow
                        key={projeto.id}
                        project={projeto}
                        onClick={() => navigate(`/projetos/${projeto.id}`)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>

            {podeProjetos && (
              <aside>
                <section aria-label="Calendário de prazos">
                  <CalendarioPreview />
                </section>
              </aside>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
}

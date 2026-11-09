import { useEffect, useRef } from "react";
import { m, useReducedMotion } from "framer-motion";
import {
  CalendarClock,
  Check,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Gauge,
  Handshake,
  History,
  Layers,
  LayoutDashboard,
  MessageSquare,
  MoreVertical,
  Receipt,
  Ruler,
  ScrollText,
  TrendingUp,
  UserRound,
  Users2,
  Wallet,
  FileBarChart,
} from "lucide-react";
import { EASE } from "../../lib/motion";
import { COLUNAS, KPIS_FINANCEIRO, KPIS_LEADS, LEAD_HEROI, MENU_FINANCEIRO, idx } from "./scene";
import { KPICard, PageHeader } from "./SceneChrome";

/* As três telas do roteiro, reproduzidas a partir do app real: rótulos, ordem
   das colunas, campos do cartão e cores de status saem do código de produção,
   não de invenção. */

const COL_LARGURA = 124;
const COL_GAP = 10;
const colX = (i: number) => i * (COL_LARGURA + COL_GAP);

/* ── Tela 1: Leads ───────────────────────────────────────────────────── */

/** Cartão do kanban: nome, empresa e valor, nas três linhas do app. */
function CartaoLead({
  titulo,
  empresa,
  valor,
  destacado,
  virouProjeto,
}: {
  titulo: string;
  empresa: string;
  valor: string;
  destacado?: boolean;
  virouProjeto?: boolean;
}) {
  return (
    <div
      className={`relative rounded-lg bg-white border px-2.5 py-2 shadow-sm transition-colors duration-300 ${
        virouProjeto
          ? "border-positive shadow-[0_8px_22px_-10px_rgba(0,0,0,0.3)]"
          : destacado
            ? "border-brand shadow-[0_8px_22px_-10px_rgba(0,0,0,0.3)]"
            : "border-app-border"
      }`}
    >
      {virouProjeto && (
        <m.span
          className="absolute -top-2 right-2 flex items-center gap-0.5 rounded-full bg-positive px-1.5 text-[8.5px] font-semibold leading-4 text-ink shadow-sm"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: EASE.out }}
        >
          <Check className="w-2.5 h-2.5" strokeWidth={3} />
          Projeto
        </m.span>
      )}
      <div className="flex items-start gap-1.5 mb-1">
        <p className="flex-1 text-[10.5px] font-medium text-ink leading-tight truncate">{titulo}</p>
        <MoreVertical className="w-2.5 h-2.5 text-black/30 shrink-0 mt-0.5" strokeWidth={2} />
      </div>
      <p className="text-[9px] text-ink-muted truncate mb-1">{empresa}</p>
      <div className="flex items-center justify-between">
        <p className="text-[9.5px] font-medium text-ink/80 tabular-nums">{valor}</p>
        <span className="w-3.5 h-3.5 rounded-full bg-app-muted" />
      </div>
    </div>
  );
}

/** Alternância Quadro/Lista do app: pílula de contorno com o ativo em brand. */
function AlternanciaVisao({ itens, ativo }: { itens: string[]; ativo: string }) {
  return (
    <span className="flex items-center gap-0.5 rounded-full border border-black/10 bg-white p-0.5 shrink-0">
      {itens.map((item) => (
        <span
          key={item}
          className={`px-2.5 py-[3px] rounded-full text-[10px] ${
            item === ativo ? "bg-brand text-ink font-medium" : "text-ink-muted"
          }`}
        >
          {item}
        </span>
      ))}
    </span>
  );
}

/** Filtro em pílula, como a barra de ferramentas do quadro. */
function FiltroPilula({ rotulo }: { rotulo: string }) {
  return (
    <span className="flex items-center gap-1 h-6 rounded-full border border-black/10 bg-white px-2.5 text-[10px] font-medium text-ink shrink-0">
      {rotulo}
      <ChevronDown className="w-2.5 h-2.5 text-black/40" strokeWidth={2} />
    </span>
  );
}

/** Ícone e tom de cada indicador do funil, na ordem do app. */
const ICONES_KPI_LEADS = [
  { Icone: Layers, tom: "neutro" },
  { Icone: TrendingUp, tom: "positivo" },
  { Icone: CalendarClock, tom: "atencao" },
  { Icone: Gauge, tom: "positivo" },
  { Icone: Handshake, tom: "atencao" },
] as const;

/** Valor no funil antes e depois do ganho: o lead sai do pipeline aberto. */
const KPIS_DEPOIS_DO_GANHO: Record<string, string> = {
  "Pipeline ativo": "11",
  "Valor no funil": "R$ 271.200",
  "Conversão de leads": "64%",
};

export function TelaLeads({ ato }: { ato: number }) {
  const moveu = ato >= idx("funil");
  const perguntando = ato === idx("converte");
  const convertido = ato >= idx("convertido");
  const iProposta = 2;
  const iGanho = 4;

  return (
    <div className="relative h-full flex flex-col">
      <PageHeader titulo="Leads" busca="Buscar por nome, empresa ou email" acao={{ label: "Novo lead" }} />

      {/* Barra de ferramentas: Quadro/Lista, filtros e ordenação. */}
      <div className="shrink-0 flex items-center gap-2 px-6 pb-3 border-b border-black/5">
        <AlternanciaVisao itens={["Quadro", "Lista"]} ativo="Quadro" />
        <FiltroPilula rotulo="Origem" />
        <FiltroPilula rotulo="Responsável" />
        <FiltroPilula rotulo="Previsão" />
        <span className="ml-auto flex items-center h-6 rounded-full border border-black/10 bg-white px-2.5 text-[10px] font-medium text-ink">
          Criação
        </span>
      </div>

      <div className="flex-1 overflow-hidden px-6 py-4">
        <div className="flex items-center gap-1.5 mb-2.5">
          <ChevronDown className="w-3 h-3 text-ink-muted" strokeWidth={2} />
          <span className="text-[10.5px] font-medium text-ink-muted">Indicadores</span>
        </div>

        <div className="grid grid-cols-5 gap-2 mb-4">
          {KPIS_LEADS.map((k, i) => (
            <KPICard
              key={k.rotulo}
              rotulo={k.rotulo}
              valor={
                <m.span
                  key={moveu ? "depois" : "antes"}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE.out }}
                  className="inline-block"
                >
                  {(moveu && KPIS_DEPOIS_DO_GANHO[k.rotulo]) || k.valor}
                </m.span>
              }
              tom={k.tom as "positivo" | undefined}
              icone={ICONES_KPI_LEADS[i].Icone}
              tomIcone={ICONES_KPI_LEADS[i].tom}
              compacto
            />
          ))}
        </div>

        {/* Kanban de seis colunas. */}
        <div className="relative" style={{ height: 236 }}>
          {COLUNAS.map((coluna, i) => {
            const total = coluna.cards.length + (i === iProposta && !moveu ? 1 : 0) + (i === iGanho && moveu ? 1 : 0);

            return (
              <div key={coluna.nome} className="absolute top-0" style={{ left: colX(i), width: COL_LARGURA }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`w-2 h-2 rounded-full ${coluna.dot}`} />
                  <span className="text-[10px] font-medium text-ink truncate">{coluna.nome}</span>
                  <m.span
                    key={`${coluna.nome}-${total}`}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: EASE.out }}
                    className="ml-auto rounded-full bg-app-muted px-1.5 text-[9px] text-ink-muted tabular-nums"
                  >
                    {total}
                  </m.span>
                </div>

                <div
                  className={`flex flex-col gap-2 rounded-xl p-2 min-h-[204px] transition-colors duration-500 ${
                    i === iGanho && moveu ? "bg-positive/10 ring-1 ring-positive/40" : "bg-app-muted/40"
                  }`}
                >
                  {/* Vaga do lead que o agente move: sem ela a coluna salta. */}
                  {i === iProposta && <span className="h-[54px] shrink-0" />}
                  {coluna.cards.map((c) => (
                    <CartaoLead key={c.titulo} {...c} />
                  ))}
                </div>
              </div>
            );
          })}

          {/* O lead herói vive fora das colunas para poder atravessar a tela. */}
          <m.div
            className="absolute z-10"
            style={{ top: 26, width: COL_LARGURA - 16 }}
            animate={{ x: moveu ? colX(iGanho) + 8 : colX(iProposta) + 8, y: moveu ? [0, -22, 0] : 0 }}
            // Só a ida é animada. No reinício do loop o cartão voltava voando
            // pelas colunas, o que lia como o agente desfazendo o trabalho.
            transition={
              moveu ? { duration: 0.85, ease: EASE.inOut, y: { duration: 0.85, times: [0, 0.5, 1] } } : { duration: 0 }
            }
          >
            <m.div animate={{ rotate: moveu ? [0, -2.5, 0] : 0 }} transition={{ duration: 0.85, ease: EASE.inOut }}>
              <CartaoLead {...LEAD_HEROI} destacado virouProjeto={convertido} />
            </m.div>
          </m.div>
        </div>
      </div>

      {/* O app pergunta, ao ganhar o lead, se ele vira projeto: converter é uma
          ação explícita, nunca efeito de arrastar (`src/pages/leads`). */}
      <m.div
        className="absolute inset-0 z-20 flex items-start justify-center bg-ink/15 pt-[226px]"
        initial={false}
        animate={{ opacity: perguntando ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        style={{ pointerEvents: "none" }}
      >
        <m.div
          className="w-[360px] rounded-2xl border border-black/5 bg-white p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.4)]"
          initial={false}
          animate={{ scale: perguntando ? 1 : 0.96, y: perguntando ? 0 : 6 }}
          transition={{ duration: 0.25, ease: EASE.out }}
        >
          <p className="text-[14px] font-medium tracking-tight text-ink">Converter em projeto</p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-muted">
            {LEAD_HEROI.titulo} · {LEAD_HEROI.valor}. O Hospital Santa Rita vira cliente e o projeto já nasce com o
            valor do contrato.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <span className="flex h-8 items-center rounded-full border border-black/10 px-3.5 text-[11.5px] text-ink-muted">
              Agora não
            </span>
            <span className="flex h-8 items-center rounded-full bg-brand px-4 text-[11.5px] font-medium text-ink">
              Converter em projeto
            </span>
          </div>
        </m.div>
      </m.div>

      {/* Confirmação no canto, como o toast do app. */}
      <m.div
        className="absolute bottom-5 right-5 z-20 flex items-center gap-3 rounded-xl bg-ink px-4 py-3 shadow-[0_16px_32px_-10px_rgba(0,0,0,0.5)]"
        initial={false}
        animate={{ opacity: convertido ? 1 : 0, y: convertido ? 0 : 12 }}
        transition={{ duration: 0.35, ease: EASE.out }}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-positive">
          <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
        </span>
        <span>
          <span className="block text-[12px] font-medium text-white">Projeto criado</span>
          <span className="block text-[10.5px] text-white/70">Hospital Santa Rita agora é cliente</span>
        </span>
      </m.div>
    </div>
  );
}

/* ── Tela 2: Financeiro ──────────────────────────────────────────────── */

const ICONES_FIN = [LayoutDashboard, Receipt, Users2, Wallet, FileBarChart];

function Contador({ alvo, ligado }: { alvo: number; ligado: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
    if (!ligado) {
      el.textContent = "R$ 0";
      return;
    }
    let raf = 0;
    const inicio = performance.now();
    const tick = (agora: number) => {
      const p = Math.min(1, (agora - inicio) / 1100);
      el.textContent = `R$ ${fmt.format(Math.round(alvo * (1 - Math.pow(1 - p, 3))))}`;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [alvo, ligado]);

  return <span ref={ref} className="tabular-nums" />;
}

const BARRAS = [
  { receita: 62, despesa: 41 },
  { receita: 74, despesa: 48 },
  { receita: 58, despesa: 44 },
  { receita: 86, despesa: 52 },
  { receita: 71, despesa: 46 },
  { receita: 96, despesa: 58 },
];

export function TelaFinanceiro({ ato }: { ato: number }) {
  const ligado = ato >= idx("financeiro");

  return (
    <div className="h-full flex flex-col">
      <PageHeader titulo="Financeiro" acao={{ label: "Novo lançamento" }} />

      {/* Abas do módulo, com os cinco itens reais. O app as põe no topo, em
          linha com sublinhado, e não numa barra lateral. */}
      <div className="shrink-0 flex items-center gap-5 px-6 border-b border-black/5">
        {MENU_FINANCEIRO.map((item, i) => {
          const Icone = ICONES_FIN[i];
          const selecionado = i === 0;
          return (
            <span
              key={item}
              className={`flex items-center gap-1.5 pb-2 -mb-px border-b-2 text-[11.5px] ${
                selecionado ? "border-ink font-medium text-ink" : "border-transparent text-black/60"
              }`}
            >
              <Icone className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
              {item}
            </span>
          );
        })}
      </div>

      <div className="flex-1 px-6 py-4 overflow-hidden">
        <span className="mb-3 inline-flex items-center gap-1.5 h-6 rounded-full border border-black/10 bg-white px-2.5 text-[10px] font-medium text-ink">
          <CalendarDays className="w-3 h-3" strokeWidth={1.6} />
          Este mês
        </span>

        <div className="grid grid-cols-3 gap-2.5 mb-3">
          {KPIS_FINANCEIRO.map((k, i) => (
            <m.div
              key={k.rotulo}
              animate={{ opacity: ligado ? 1 : 0, y: ligado ? 0 : 8 }}
              transition={{ duration: 0.4, delay: i * 0.06, ease: EASE.out }}
            >
              <KPICard
                rotulo={k.rotulo}
                valor={<Contador alvo={k.valor} ligado={ligado} />}
                sub={k.sub}
                tom={k.tom as "positivo" | "negativo"}
                compacto
              />
            </m.div>
          ))}
        </div>

        {/* Card "Fluxo Financeiro": barras de receita e despesa mais a linha
            de saldo, como no ComposedChart do app. */}
        <div className="rounded-2xl border border-black/5 bg-white p-4" style={{ height: 196 }}>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[12px] font-medium text-ink">Fluxo Financeiro</p>
            <p className="text-[10px] text-ink-muted">Comparativo de Receitas x Despesas (Mensal)</p>
            <AlternanciaVisao itens={["Comparativo", "Performance"]} ativo="Comparativo" />
          </div>

          <div className="relative flex items-end gap-6 h-[110px] px-1">
            {BARRAS.map((b, i) => (
              <div key={i} className="flex-1 flex items-end justify-center gap-1 h-full">
                <m.span
                  className="w-1/3 rounded-t-[3px] bg-chart-success origin-bottom"
                  style={{ height: `${b.receita}%` }}
                  animate={{ scaleY: ligado ? 1 : 0 }}
                  transition={{ duration: 0.6, delay: 0.2 + i * 0.055, ease: EASE.out }}
                />
                <m.span
                  className="w-1/3 rounded-t-[3px] bg-chart-danger origin-bottom"
                  style={{ height: `${b.despesa}%` }}
                  animate={{ scaleY: ligado ? 1 : 0 }}
                  transition={{ duration: 0.6, delay: 0.26 + i * 0.055, ease: EASE.out }}
                />
              </div>
            ))}

            {/* Linha de saldo líquido por cima das barras. */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              <m.polyline
                points="8,52 25,42 42,55 58,30 75,44 92,22"
                fill="none"
                stroke="hsl(var(--text-ink))"
                strokeWidth="1.1"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: ligado ? 1 : 0 }}
                transition={{ duration: 1, delay: 0.5, ease: EASE.out }}
              />
            </svg>
          </div>

          <div className="flex justify-between px-1 mt-1.5">
            {["mar", "abr", "mai", "jun", "jul", "ago"].map((mes) => (
              <span key={mes} className="flex-1 text-center text-[8.5px] text-ink-muted">
                {mes}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Tela 3: Projeto ─────────────────────────────────────────────────── */

/** Abas do detalhe do projeto, na ordem do app. */
const ABAS_PROJETO = [
  { nome: "Disciplinas", Icone: Layers },
  { nome: "Atividades", Icone: MessageSquare },
  { nome: "Pagamentos", Icone: CircleDollarSign },
  { nome: "Escopo", Icone: ScrollText },
  { nome: "Histórico", Icone: History },
] as const;

/** Disciplinas do projeto: prioridade e status saem do registry do app (ponto colorido + rótulo). */
const DISCIPLINAS: {
  disc: string;
  prioridade: [string, string];
  status: [string, string];
  resp: string;
  prev: string;
}[] = [
  {
    disc: "Estrutural",
    prioridade: ["Alta", "bg-chart-danger"],
    status: ["Concluído", "bg-status-done"],
    resp: "R. Souza",
    prev: "12/08",
  },
  {
    disc: "Elétrico",
    prioridade: ["Média", "bg-chart-warning"],
    status: ["Revisão", "bg-status-review"],
    resp: "M. Alves",
    prev: "28/09",
  },
  {
    disc: "Climatização",
    prioridade: ["Alta", "bg-chart-danger"],
    status: ["Em andamento", "bg-status-progress"],
    resp: "J. Lima",
    prev: "15/10",
  },
];

const COLUNAS_DISC = "grid-cols-[1.3fr_0.8fr_1.1fr_0.7fr_1fr]";

/** Barras do Gantt, em % de uma janela de jul a dez. Mock estático, não cálculo. */
const GANTT: { disc: string; ini: number; fim: number; cor: string; feito: number }[] = [
  { disc: "Estrutural", ini: 0, fim: 26, cor: "bg-status-done", feito: 1 },
  { disc: "Elétrico", ini: 14, fim: 52, cor: "bg-status-review", feito: 0.85 },
  { disc: "Climatização", ini: 22, fim: 76, cor: "bg-status-progress", feito: 0.55 },
  { disc: "Gases medicinais", ini: 48, fim: 92, cor: "bg-status-planning", feito: 0.1 },
];
const MESES_GANTT = ["jul", "ago", "set", "out", "nov", "dez"];
const HOJE_GANTT = 58;

function GanttProjeto() {
  return (
    <div className="rounded-lg border border-app-border overflow-hidden">
      <div className="grid grid-cols-[120px_1fr] border-b border-app-border">
        <span className="px-3 py-1.5 text-[8.5px] uppercase tracking-wide text-ink-muted">Disciplina</span>
        <div className="grid grid-cols-6">
          {MESES_GANTT.map((mes) => (
            <span key={mes} className="py-1.5 text-center text-[8.5px] uppercase tracking-wide text-ink-muted">
              {mes}
            </span>
          ))}
        </div>
      </div>
      <div className="relative">
        {GANTT.map((g, i) => (
          <div
            key={g.disc}
            className="grid grid-cols-[120px_1fr] items-center border-b border-app-border last:border-0"
          >
            <span className="px-3 py-[7px] text-[10.5px] font-medium text-ink">{g.disc}</span>
            <div className="relative h-[26px]">
              <m.span
                className={`absolute top-[7px] h-3 rounded-full ${g.cor} origin-left overflow-hidden`}
                style={{ left: `${g.ini}%`, width: `${g.fim - g.ini}%` }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.45, delay: 0.1 + i * 0.08, ease: EASE.out }}
              >
                {/* Parte já executada, mais escura. */}
                <span className="absolute inset-y-0 left-0 bg-ink/20" style={{ width: `${g.feito * 100}%` }} />
              </m.span>
            </div>
          </div>
        ))}
        {/* Linha de hoje atravessando as disciplinas. */}
        <m.span
          className="absolute top-0 bottom-0 w-px bg-chart-danger"
          style={{ left: `calc(120px + (100% - 120px) * ${HOJE_GANTT / 100})` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.5 }}
        >
          <span className="absolute -top-px left-1 rounded bg-chart-danger px-1 text-[7.5px] font-medium leading-3 text-white">
            hoje
          </span>
        </m.span>
      </div>
    </div>
  );
}

export function TelaProjeto({ ato }: { ato: number }) {
  const ligado = ato >= idx("projeto");
  const gantt = ato >= idx("gantt");
  const reducedMotion = useReducedMotion();

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        titulo="Climatização de centro cirúrgico"
        trilha="Projetos"
        secundarias={["Pausar projeto"]}
        acao={{ label: "Editar", primaria: false }}
      />

      {/* Abas do projeto, em linha com sublinhado. */}
      <div className="shrink-0 flex items-center gap-5 px-6 border-b border-black/5">
        {ABAS_PROJETO.map(({ nome, Icone }, i) => (
          <span
            key={nome}
            className={`flex items-center gap-1.5 pb-2 -mb-px border-b-2 text-[11.5px] ${
              i === 0 ? "border-ink font-medium text-ink" : "border-transparent text-black/60"
            }`}
          >
            <Icone className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
            {nome}
          </span>
        ))}
      </div>

      <div className="flex-1 px-6 py-4 overflow-hidden">
        {/* Título com status, prioridade e prazo. As cores seguem o app: status
            em azul suave, prioridade em vermelho suave com ponto, prazo em
            verde cheio com texto escuro. */}
        <div className="flex items-center gap-2 mb-3.5">
          <span className="text-[17px] font-bold tracking-tight text-ink">Climatização de centro cirúrgico</span>
          <span className="flex items-center gap-1 h-5 rounded-full bg-info-soft px-2 text-[9.5px] font-medium text-info-strong">
            Em andamento
            <ChevronDown className="w-2.5 h-2.5" strokeWidth={2} />
          </span>
          <span className="flex items-center gap-1 h-5 rounded-full bg-danger-soft px-2 text-[9.5px] font-medium text-danger-strong">
            <span className="w-1.5 h-1.5 rounded-full bg-chart-danger" />
            Alta
            <ChevronDown className="w-2.5 h-2.5" strokeWidth={2} />
          </span>
          <span className="flex items-center h-5 rounded-full bg-status-done px-2 text-[9.5px] font-medium text-ink">
            No Prazo (12d)
          </span>
        </div>

        {/* Cinco KPIs do projeto, com a margem por último. */}
        <div className="grid grid-cols-5 gap-2.5 mb-3.5">
          {[
            { rotulo: "Cliente", valor: "Hospital Santa Rita", icone: UserRound },
            { rotulo: "Contrato", valor: "R$ 385.200", icone: CircleDollarSign },
            { rotulo: "Área", valor: "1.240 m²", icone: Ruler },
            { rotulo: "Prazo", valor: "30/11/2026", icone: CalendarDays },
          ].map((k, i) => (
            <m.div
              key={k.rotulo}
              animate={{ opacity: ligado ? 1 : 0, y: ligado ? 0 : 8 }}
              transition={{ duration: 0.4, delay: i * 0.06, ease: EASE.out }}
            >
              <KPICard
                rotulo={k.rotulo}
                valor={<span className="text-[12.5px] font-medium">{k.valor}</span>}
                icone={k.icone}
                compacto
              />
            </m.div>
          ))}

          <m.div
            animate={{ opacity: ligado ? 1 : 0, y: ligado ? 0 : 8 }}
            transition={{ duration: 0.4, delay: 0.26, ease: EASE.out }}
          >
            {/* ≥ 20% pinta de positivo, regra do ProjetoDetailInfo. */}
            <KPICard rotulo="Margem Bruta" valor="31,4%" tom="positivo" compacto />
          </m.div>
        </div>

        <div className="mb-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-ink-muted">Progresso das disciplinas</span>
            <span className="text-[10px] font-medium text-ink">72%</span>
          </div>
          <div className="h-2 rounded-full bg-app-muted overflow-hidden">
            <m.span
              className="block h-full w-full rounded-full bg-brand origin-left"
              initial={reducedMotion ? false : { scaleX: 0 }}
              animate={{ scaleX: ligado ? 0.72 : 0 }}
              transition={{ duration: 1, ease: EASE.out, delay: 0.3 }}
            />
          </div>
        </div>

        <div className="flex justify-end mb-2">
          <AlternanciaVisao itens={["Tabela", "Gantt", "Fluxo"]} ativo={gantt ? "Gantt" : "Tabela"} />
        </div>

        {/* Tabela de disciplinas, num cartão com ação de adicionar. */}
        <div className="rounded-2xl border border-black/5 bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-ink-muted">{gantt ? "4 disciplinas" : "3 disciplinas"}</span>
            <span className="flex items-center h-6 rounded-full bg-brand px-3 text-[10px] font-medium text-ink">
              Adicionar disciplina
            </span>
          </div>

          {gantt ? (
            <GanttProjeto />
          ) : (
            <div className="rounded-lg border border-app-border overflow-hidden">
              <div className={`grid ${COLUNAS_DISC} gap-2 px-3 py-1.5 border-b border-app-border`}>
                {["Disciplina", "Prioridade", "Status", "Previsão", "Responsáveis"].map((c) => (
                  <span key={c} className="text-[8.5px] uppercase tracking-wide text-ink-muted">
                    {c}
                  </span>
                ))}
              </div>
              {DISCIPLINAS.map(({ disc, prioridade, status, resp, prev }, i) => (
                <m.div
                  key={disc}
                  className={`grid ${COLUNAS_DISC} gap-2 px-3 py-[7px] border-b border-app-border last:border-0 items-center`}
                  animate={{ opacity: ligado ? 1 : 0, x: ligado ? 0 : 8 }}
                  transition={{ duration: 0.4, delay: 0.35 + i * 0.08, ease: EASE.out }}
                >
                  <span className="text-[10.5px] font-medium text-ink">{disc}</span>
                  <span className="flex items-center gap-1.5 text-[9.5px] text-ink">
                    <span className={`w-1.5 h-1.5 rounded-full ${prioridade[1]}`} />
                    {prioridade[0]}
                  </span>
                  <span className="flex items-center gap-1.5 text-[9.5px] text-ink">
                    <span className={`w-1.5 h-1.5 rounded-full ${status[1]}`} />
                    {status[0]}
                  </span>
                  <span className="text-[9.5px] text-ink-muted tabular-nums">{prev}</span>
                  <span className="text-[9.5px] text-ink">{resp}</span>
                </m.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

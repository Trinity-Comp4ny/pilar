import { useEffect, useRef } from "react";
import { m, useReducedMotion } from "framer-motion";
import { ChevronDown, LayoutDashboard, MoreVertical, Receipt, Users2, Wallet, FileBarChart } from "lucide-react";
import { EASE } from "../../lib/motion";
import { COLUNAS, KPIS_FINANCEIRO, KPIS_LEADS, LEAD_HEROI, MENU_FINANCEIRO, idx } from "./scene";
import { KPICard, PageHeader } from "./SceneChrome";

/* As três telas do roteiro, reproduzidas a partir do app real: rótulos, ordem
   das colunas, campos do cartão e cores de status saem do código de produção,
   não de invenção. */

const COL_LARGURA = 130;
const COL_GAP = 10;
const colX = (i: number) => i * (COL_LARGURA + COL_GAP);

/* ── Tela 1: Leads ───────────────────────────────────────────────────── */

/** Cartão do kanban: nome, empresa e valor, nas três linhas do app. */
function CartaoLead({
  titulo,
  empresa,
  valor,
  destacado,
}: {
  titulo: string;
  empresa: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div
      className={`rounded-lg bg-white border px-2.5 py-2 ${
        destacado ? "border-modulo-gestao-strong shadow-[0_8px_22px_-10px_rgba(0,0,0,0.3)]" : "border-black/5"
      }`}
    >
      <div className="flex items-start gap-1.5 mb-1">
        <p className="flex-1 text-[10.5px] font-medium text-ink leading-tight truncate">{titulo}</p>
        <MoreVertical className="w-2.5 h-2.5 text-black/20 shrink-0 mt-0.5" strokeWidth={2} />
      </div>
      <p className="text-[9px] text-ink-muted truncate mb-1">{empresa}</p>
      <div className="flex items-center justify-between">
        <p className="text-[9.5px] font-medium text-ink/80 tabular-nums">{valor}</p>
        <span className="w-3.5 h-3.5 rounded-full bg-paper-border" />
      </div>
    </div>
  );
}

export function TelaLeads({ ato }: { ato: number }) {
  const moveu = ato >= idx("funil");
  const iProposta = 2;
  const iGanho = 4;

  return (
    <div className="h-full flex flex-col">
      <PageHeader titulo="Leads" busca="Buscar por nome, empresa ou email" acao={{ label: "Novo lead" }} />

      <div className="flex-1 overflow-hidden px-6 py-4">
        {/* Faixa de indicadores, com o toggle Quadro/Lista à direita. */}
        <div className="flex items-center gap-2 mb-3">
          <ChevronDown className="w-3 h-3 text-ink-muted" strokeWidth={2} />
          <span className="text-[10.5px] font-medium text-ink-muted">Indicadores</span>
          <span className="ml-auto flex items-center gap-0.5 rounded-full border border-black/10 p-0.5">
            <span className="px-2.5 py-[3px] rounded-full bg-brand text-ink text-[10px] font-medium">Quadro</span>
            <span className="px-2.5 py-[3px] text-[10px] text-ink-muted">Lista</span>
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2 mb-4">
          {KPIS_LEADS.map((k) => (
            <KPICard key={k.rotulo} rotulo={k.rotulo} valor={k.valor} tom={k.tom as "positivo" | undefined} compacto />
          ))}
        </div>

        {/* Kanban de seis colunas. */}
        <div className="relative" style={{ height: 236 }}>
          {COLUNAS.map((coluna, i) => {
            const total =
              coluna.cards.length + (i === iProposta && !moveu ? 1 : 0) + (i === iGanho && moveu ? 1 : 0);

            return (
              <div key={coluna.nome} className="absolute top-0" style={{ left: colX(i), width: COL_LARGURA }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`w-2 h-2 rounded-full ${coluna.dot}`} />
                  <span className="text-[9px] font-medium uppercase tracking-wide text-ink/80 truncate">
                    {coluna.nome}
                  </span>
                  <m.span
                    key={`${coluna.nome}-${total}`}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: EASE.out }}
                    className="ml-auto text-[9px] text-ink-muted tabular-nums"
                  >
                    {total}
                  </m.span>
                </div>

                <div className="flex flex-col gap-2 rounded-lg bg-paper-alt p-2 min-h-[204px]">
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
              moveu
                ? { duration: 0.85, ease: EASE.inOut, y: { duration: 0.85, times: [0, 0.5, 1] } }
                : { duration: 0 }
            }
          >
            <m.div animate={{ rotate: moveu ? [0, -2.5, 0] : 0 }} transition={{ duration: 0.85, ease: EASE.inOut }}>
              <CartaoLead {...LEAD_HEROI} destacado />
            </m.div>
          </m.div>
        </div>
      </div>
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
    <div className="h-full flex">
      {/* Barra secundária do Financeiro, com os cinco itens reais. */}
      <div className="w-[168px] shrink-0 border-r border-black/5 bg-white py-3 px-2.5">
        <p className="px-2 pb-2 text-[9px] uppercase tracking-[0.08em] text-black/40">Menu</p>
        {MENU_FINANCEIRO.map((item, i) => {
          const Icone = ICONES_FIN[i];
          const selecionado = i === 0;
          return (
            <div
              key={item}
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-full text-[11.5px] mb-0.5 ${
                selecionado ? "bg-brand text-black/80 font-medium" : "text-black/70"
              }`}
            >
              <Icone className="w-[15px] h-[15px] shrink-0" strokeWidth={1.5} />
              <span className="truncate">{item}</span>
            </div>
          );
        })}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader titulo="Financeiro" acao={{ label: "Novo lançamento" }} />

        <div className="flex-1 px-6 py-4 overflow-hidden">
          <div className="grid grid-cols-5 gap-2.5 mb-4">
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
          <div className="rounded-2xl border border-black/5 bg-white p-4" style={{ height: 214 }}>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[12px] font-medium text-ink">Fluxo Financeiro</p>
              <p className="text-[10px] text-ink-muted">Comparativo de Receitas x Despesas (Mensal)</p>
              <span className="ml-auto flex items-center gap-0.5 rounded-full border border-black/10 p-0.5">
                <span className="px-2 py-[2px] rounded-full bg-brand text-ink text-[9px] font-medium">Comparativo</span>
                <span className="px-2 py-[2px] text-[9px] text-ink-muted">Performance</span>
              </span>
            </div>

            <div className="relative flex items-end gap-6 h-[132px] px-1">
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
              <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
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
    </div>
  );
}

/* ── Tela 3: Projeto ─────────────────────────────────────────────────── */

export function TelaProjeto({ ato }: { ato: number }) {
  const ligado = ato >= idx("projeto");
  const reducedMotion = useReducedMotion();

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        titulo="Climatização de centro cirúrgico"
        trilha="Projetos"
        acao={{ label: "Editar", primaria: false }}
      />

      <div className="flex-1 px-6 py-4 overflow-hidden">
        {/* Strip de contexto: código, status, prioridade e prazo. */}
        <div className="flex items-center gap-2.5 mb-4">
          <span className="text-[17px] font-bold tracking-tight text-ink">PRJ-024</span>
          <span className="flex items-center gap-1 h-6 rounded-full bg-status-progress/15 px-2.5 text-[10px] font-medium text-status-progress">
            Em andamento
            <ChevronDown className="w-2.5 h-2.5" strokeWidth={2} />
          </span>
          <span className="h-6 flex items-center rounded-full bg-red-50 px-2.5 text-[10px] font-medium text-red-700">
            Alta
          </span>
          <span className="h-6 flex items-center rounded-full bg-status-done px-2.5 text-[10px] font-medium text-white">
            No Prazo (12d)
          </span>
        </div>

        {/* Cinco KPIs do projeto, com a margem por último. */}
        <div className="grid grid-cols-5 gap-2.5 mb-4">
          {[
            { rotulo: "Cliente", valor: "Hospital Santa Rita" },
            { rotulo: "Contrato", valor: "R$ 385.200" },
            { rotulo: "Área", valor: "1.240 m²" },
            { rotulo: "Prazo", valor: "30/11/2026" },
          ].map((k, i) => (
            <m.div
              key={k.rotulo}
              animate={{ opacity: ligado ? 1 : 0, y: ligado ? 0 : 8 }}
              transition={{ duration: 0.4, delay: i * 0.06, ease: EASE.out }}
            >
              <div className="rounded-2xl border border-black/5 bg-white p-3">
                <p className="text-[9.5px] uppercase tracking-wider text-ink-muted mb-1.5">{k.rotulo}</p>
                <p className="text-[12.5px] font-medium text-ink truncate">{k.valor}</p>
              </div>
            </m.div>
          ))}

          <m.div
            animate={{ opacity: ligado ? 1 : 0, y: ligado ? 0 : 8 }}
            transition={{ duration: 0.4, delay: 0.26, ease: EASE.out }}
          >
            <div className="rounded-2xl border border-black/5 bg-white p-3">
              <p className="text-[9.5px] uppercase tracking-wider text-ink-muted mb-1.5">Margem Bruta</p>
              {/* ≥ 20% pinta de positivo, regra do ProjetoDetailInfo. */}
              <p className="text-[17px] font-bold tabular-nums leading-none text-positive-strong">31,4%</p>
            </div>
          </m.div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-ink-muted">Progresso das disciplinas</span>
            <span className="text-[10px] font-medium text-ink">72%</span>
          </div>
          <div className="h-2 rounded-full bg-paper-alt overflow-hidden">
            <m.span
              className="block h-full w-full rounded-full bg-brand origin-left"
              initial={reducedMotion ? false : { scaleX: 0 }}
              animate={{ scaleX: ligado ? 0.72 : 0 }}
              transition={{ duration: 1, ease: EASE.out, delay: 0.3 }}
            />
          </div>
        </div>

        {/* Abas do projeto e a tabela de disciplinas. */}
        <div className="flex gap-3">
          <div className="w-[132px] shrink-0">
            {[
              { nome: "Disciplinas", ativo: true },
              { nome: "Pagamentos", ativo: false },
            ].map((t) => (
              <div
                key={t.nome}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full text-[11.5px] mb-0.5 ${
                  t.ativo ? "bg-brand text-black/80 font-medium" : "text-black/70"
                }`}
              >
                {t.nome}
              </div>
            ))}
          </div>

          <div className="flex-1 rounded-2xl border border-black/5 bg-white overflow-hidden">
            <div className="grid grid-cols-[1.4fr_1fr_1fr_0.9fr] gap-2 px-3 py-2 bg-paper-alt/50 border-b border-black/5">
              {["Disciplina", "Status", "Responsáveis", "Previsão"].map((c) => (
                <span key={c} className="text-[8.5px] uppercase tracking-wide text-ink-muted">
                  {c}
                </span>
              ))}
            </div>
            {[
              ["Estrutural", "Concluído", "R. Souza", "12/08"],
              ["Elétrico", "Revisão", "M. Alves", "28/09"],
              ["Climatização", "Em andamento", "J. Lima", "15/10"],
            ].map(([disc, status, resp, prev], i) => (
              <m.div
                key={disc}
                className="grid grid-cols-[1.4fr_1fr_1fr_0.9fr] gap-2 px-3 py-[7px] border-b border-black/5 last:border-0 items-center"
                animate={{ opacity: ligado ? 1 : 0, x: ligado ? 0 : 8 }}
                transition={{ duration: 0.4, delay: 0.35 + i * 0.08, ease: EASE.out }}
              >
                <span className="text-[10.5px] text-ink">{disc}</span>
                <span className="text-[9.5px] text-ink-soft">{status}</span>
                <span className="text-[9.5px] text-ink-muted">{resp}</span>
                <span className="text-[9.5px] text-ink-muted tabular-nums">{prev}</span>
              </m.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

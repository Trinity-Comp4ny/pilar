/**
 * Telas de produto desenhadas em vetor, uma por módulo. Substituem o print
 * estático: nada aqui é imagem, então não corta, não pixela e não desatualiza
 * junto com a UI real. Toda animação respeita `prefers-reduced-motion`.
 */
import { m, useReducedMotion } from "framer-motion";
import type { ModuloSlug } from "../../lib/modules";

/* ── Gestão: funil de leads, com um card trocando de coluna ───────────── */

const LEADS = [
  { col: "Em contato", n: 4, cards: [{ t: "Retrofit elétrico, hospital", v: "R$ 84.000" }] },
  { col: "Proposta", n: 3, cards: [{ t: "Climatização, centro cirúrgico", v: "R$ 128.400" }] },
  { col: "Negociação", n: 2, cards: [{ t: "Fotovoltaico, condomínio", v: "R$ 71.200" }] },
  { col: "Ganho", n: 6, cards: [{ t: "Gases medicinais, clínica", v: "R$ 58.000" }] },
];

function Card({ t, v, className = "" }: { t: string; v: string; className?: string }) {
  return (
    <div className={`bg-white border border-paper-border/60 rounded-md p-2 shadow-sm ${className}`}>
      <p className="text-[9.5px] leading-tight font-medium text-ink mb-1.5">{t}</p>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full bg-paper-border shrink-0" />
        <span className="text-[8px] text-ink-muted tabular-nums">{v}</span>
      </div>
    </div>
  );
}

/**
 * Estático de propósito: nas páginas de módulo a tela faz papel de print do
 * produto, e um card se mexendo em loop vira ruído, não demonstração.
 */
export function KanbanScreen() {
  return (
    <div>
      <ScreenHead crumb="Gestão · Comercial" title="Funil de leads" chip="+ Novo lead" />
      <div className="grid grid-cols-4 gap-2">
        {LEADS.map((c) => (
          <div key={c.col} className="bg-paper-alt rounded-lg p-2 min-h-[168px]">
            <div className="flex justify-between text-[8px] uppercase tracking-wider text-ink-muted mb-2">
              <span>{c.col}</span>
              <span>{c.n}</span>
            </div>

            {c.cards.map((card) => (
              <Card key={card.t} {...card} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Projetos: Gantt das disciplinas ──────────────────────────────────── */

const BARRAS = [
  { label: "Estrutural", left: "2%", width: "44%", tone: "bg-modulo-projetos-strong" },
  { label: "Elétrico", left: "14%", width: "38%", tone: "bg-modulo-projetos-strong" },
  { label: "Hidrossanitário", left: "22%", width: "34%", tone: "bg-modulo-gestao-strong" },
  { label: "Climatização", left: "38%", width: "31%", tone: "bg-modulo-obra-strong" },
  { label: "Compatibilização", left: "62%", width: "26%", tone: "bg-paper-border" },
  { label: "Entrega final", left: "84%", width: "13%", tone: "bg-paper-border" },
];

export function GanttScreen() {
  const reduced = useReducedMotion();

  return (
    <div>
      <ScreenHead crumb="Projetos · Carteira" title="Cronograma das disciplinas" chip="Gantt" />
      <div className="flex justify-between text-[7.5px] uppercase tracking-wider text-ink-muted pl-[104px] mb-1">
        {["Set", "Out", "Nov", "Dez", "Jan"].map((mes) => (
          <span key={mes}>{mes}</span>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {BARRAS.map((b, i) => (
          <div key={b.label} className="grid grid-cols-[100px_1fr] gap-1.5 items-center">
            <span className="text-[9.5px] text-ink-soft truncate">{b.label}</span>
            <div className="h-[15px] bg-paper-alt rounded relative overflow-hidden">
              <m.span
                className={`absolute top-0.5 h-[11px] rounded-sm origin-left ${b.tone}`}
                style={{ left: b.left, width: b.width }}
                initial={reduced ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1.1, ease: [0.22, 0.9, 0.28, 1], delay: reduced ? 0 : i * 0.09 }}
              />
              <span className="absolute inset-y-0 w-px bg-ink/30" style={{ left: "46%" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Obra: diário do dia, vindo do campo ──────────────────────────────── */

export function DiarioScreen() {
  const reduced = useReducedMotion();

  return (
    <div>
      <ScreenHead crumb="Obra · Diário" title="Diário de obra de hoje" chip="Veio do campo" />
      <div className="grid md:grid-cols-[1.15fr_1fr] gap-3">
        <div className="bg-paper-alt rounded-lg p-3">
          <p className="text-[8px] uppercase tracking-wider text-ink-muted mb-2">Registro do dia</p>
          {[
            ["Clima", "Nublado"],
            ["Efetivo em obra", "14"],
            ["Alvenaria 3º pav.", "62 m²"],
            ["Ocorrências", "1"],
          ].map(([k, v]) => (
            <div
              key={k}
              className="flex justify-between text-[9.5px] text-ink-soft py-1 border-b border-paper-border/50 last:border-0"
            >
              <span>{k}</span>
              <span className="text-ink tabular-nums">{v}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 mt-2 text-[8px] uppercase tracking-wider text-modulo-gestao-strong">
            <span className="w-1.5 h-1.5 rounded-full bg-modulo-gestao-strong" />
            Sincronizado do celular
          </div>
        </div>

        <div className="bg-paper-alt rounded-lg p-3">
          <p className="text-[8px] uppercase tracking-wider text-ink-muted mb-2">Fotos do canteiro</p>
          <div className="grid grid-cols-3 gap-1.5">
            {[0, 1, 2].map((i) => (
              <m.span
                key={i}
                className="aspect-square rounded bg-gradient-to-br from-paper-border to-paper-alt block"
                initial={reduced ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: reduced ? 0 : i * 0.14 }}
              />
            ))}
          </div>
          {[
            ["Frente", "Estrutura"],
            ["Tarefa marcada", "Concluída"],
          ].map(([k, v]) => (
            <div
              key={k}
              className="flex justify-between text-[9.5px] text-ink-soft py-1 border-b border-paper-border/50 last:border-0 mt-2 first:mt-2"
            >
              <span>{k}</span>
              <span className="text-ink">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Portal: o que o cliente vê pelo link, só leitura ─────────────────── */

const DISCIPLINAS_PORTAL = [
  { nome: "Estrutural", pct: 100 },
  { nome: "Elétrico", pct: 100 },
  { nome: "Climatização", pct: 45 },
];

const PARCELAS_PORTAL = [
  { nome: "Parcela 1", valor: "R$ 42.800", status: "Paga", paga: true },
  { nome: "Parcela 2", valor: "R$ 42.800", status: "Em aberto" },
  { nome: "Parcela 3", valor: "R$ 42.800", status: "Dezembro" },
];

export function PortalScreen() {
  const reduced = useReducedMotion();

  return (
    <div>
      <ScreenHead
        crumb="Portal do cliente · Só leitura"
        title="Centro cirúrgico, Santa Rita"
        chip="Link compartilhado"
      />
      <div className="grid md:grid-cols-2 gap-3">
        <div className="bg-paper-alt rounded-lg p-3">
          <p className="text-[8px] uppercase tracking-wider text-ink-muted mb-2.5">Andamento por disciplina</p>
          {DISCIPLINAS_PORTAL.map((d, i) => (
            <div key={d.nome} className="mb-2.5 last:mb-0">
              <div className="flex justify-between text-[9.5px] mb-1">
                <span className="text-ink-soft">{d.nome}</span>
                <span className="text-ink tabular-nums">{d.pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-paper-border/50 overflow-hidden">
                <m.span
                  className={`block h-full rounded-full origin-left ${d.pct === 100 ? "bg-ink" : "bg-brand"}`}
                  style={{ width: `${d.pct}%` }}
                  initial={reduced ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.9, delay: reduced ? 0 : 0.2 + i * 0.12, ease: [0.22, 0.9, 0.28, 1] }}
                />
              </div>
            </div>
          ))}
          <p className="mt-2.5 pt-2 border-t border-paper-border/50 text-[8.5px] text-ink-muted">
            Atualizado hoje, direto do cronograma
          </p>
        </div>

        <div className="bg-paper-alt rounded-lg p-3">
          <p className="text-[8px] uppercase tracking-wider text-ink-muted mb-2">Parcelas do contrato</p>
          {PARCELAS_PORTAL.map((p) => (
            <div
              key={p.nome}
              className="flex items-center justify-between gap-2 py-1.5 border-b border-paper-border/50 last:border-0"
            >
              <span className="text-[9.5px] text-ink-soft">{p.nome}</span>
              <span className="flex items-center gap-2">
                <span className="text-[9.5px] font-medium text-ink tabular-nums">{p.valor}</span>
                <span
                  className={`text-[7.5px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                    p.paga ? "bg-brand text-ink" : "bg-paper-border/60 text-ink-muted"
                  }`}
                >
                  {p.status}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Campo: o celular do encarregado, desenhado à mão em CSS ──────────── */

export function CampoScreen() {
  const reduced = useReducedMotion();

  return (
    <div className="mx-auto w-[300px]">
      <div className="rounded-[36px] border-[3px] border-ink bg-ink shadow-[0_28px_56px_-20px_rgba(0,0,0,0.45)]">
        <div className="relative overflow-hidden rounded-[32px] bg-frame">
          <span className="absolute left-1/2 top-3.5 h-6 w-20 -translate-x-1/2 rounded-full bg-ink" />

          <div className="px-4 pb-6 pt-12">
            <div className="flex items-center justify-between pb-3">
              <div>
                <p className="text-[8px] uppercase tracking-wider text-ink-muted">Obra Santa Rita</p>
                <p className="text-[13px] font-semibold tracking-tight text-ink">Diário de hoje</p>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-paper-alt px-2 py-1 text-[7.5px] uppercase tracking-wider text-ink-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-chart-warning" />
                Sem sinal
              </span>
            </div>

            <div className="rounded-lg bg-paper-alt p-2.5 mb-2.5">
              {[
                ["Clima", "Nublado"],
                ["Efetivo em obra", "14"],
                ["Alvenaria 3º pav.", "62 m²"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between text-[10px] text-ink-soft py-1 border-b border-paper-border/50 last:border-0"
                >
                  <span>{k}</span>
                  <span className="text-ink tabular-nums">{v}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-1.5 mb-2.5">
              {[0, 1, 2].map((i) => (
                <m.span
                  key={i}
                  className="aspect-square rounded-md bg-gradient-to-br from-paper-border to-paper-alt block"
                  initial={reduced ? false : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: reduced ? 0 : 0.3 + i * 0.12 }}
                />
              ))}
            </div>

            <div className="flex items-center justify-between rounded-lg bg-paper-alt px-2.5 py-2 mb-3">
              <span className="text-[10px] text-ink">Tarefa do cronograma</span>
              <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-brand text-ink">
                Concluída
              </span>
            </div>

            <span className="flex h-9 w-full items-center justify-center rounded-full bg-brand text-[12px] font-medium text-ink">
              Enviar o dia
            </span>
            <m.p
              className="mt-2 text-center text-[8px] text-ink-muted"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: reduced ? 0 : 0.9 }}
            >
              Fica no aparelho e sobe sozinho quando o sinal voltar
            </m.p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Compartilhado ────────────────────────────────────────────────────── */

function ScreenHead({ crumb, title, chip }: { crumb: string; title: string; chip: string }) {
  return (
    <div className="flex justify-between items-start gap-3 mb-4">
      <div>
        <p className="text-[8.5px] uppercase tracking-[0.1em] text-ink-muted mb-1">{crumb}</p>
        <p className="text-[14.5px] font-medium text-ink tracking-tight">{title}</p>
      </div>
      <span className="text-[9.5px] px-2.5 py-1 rounded-full bg-brand text-ink-on-brand font-semibold shrink-0">
        {chip}
      </span>
    </div>
  );
}

export function ModuleScreen({ slug }: { slug: ModuloSlug }) {
  if (slug === "gestao") return <KanbanScreen />;
  if (slug === "projetos") return <GanttScreen />;
  if (slug === "portal") return <PortalScreen />;
  if (slug === "campo") return <CampoScreen />;
  return <DiarioScreen />;
}

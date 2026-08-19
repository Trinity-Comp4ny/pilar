/**
 * Telas de produto desenhadas em vetor, uma por módulo. Substituem o print
 * estático: nada aqui é imagem, então não corta, não pixela e não desatualiza
 * junto com a UI real. Toda animação respeita `prefers-reduced-motion`.
 */
import { m, useReducedMotion } from "framer-motion";
import type { ModuloSlug } from "../../lib/modules";

const LOOP = { repeat: Infinity, repeatDelay: 0 } as const;

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

export function KanbanScreen() {
  const reduced = useReducedMotion();

  return (
    <div>
      <ScreenHead crumb="Gestão · Comercial" title="Funil de leads" chip="+ Novo lead" />
      <div className="grid grid-cols-4 gap-2">
        {LEADS.map((c, i) => (
          <div key={c.col} className="bg-paper-alt rounded-lg p-2 min-h-[168px]">
            <div className="flex justify-between text-[8px] uppercase tracking-wider text-ink-muted mb-2">
              <span>{c.col}</span>
              <span>{c.n}</span>
            </div>

            {i === 2 && !reduced && (
              <m.div
                className="border border-dashed border-modulo-gestao-strong rounded-md mb-1.5"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: [0, 0, 0.65, 0.65, 0], height: [0, 0, 34, 34, 0] }}
                transition={{ duration: 6, times: [0, 0.44, 0.52, 0.7, 0.8], ...LOOP }}
              />
            )}

            {c.cards.map((card) =>
              i === 1 && !reduced ? (
                <m.div
                  key={card.t}
                  animate={{ x: [0, 0, 6, 0, 0], y: [0, 0, -4, 0, 0] }}
                  transition={{ duration: 6, times: [0, 0.42, 0.5, 0.58, 1], ...LOOP }}
                >
                  <Card {...card} />
                </m.div>
              ) : (
                <Card key={card.t} {...card} />
              )
            )}
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
      <ScreenHead crumb="Obra · Diário" title="Diário de obra, 18 de agosto" chip="Veio do campo" />
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
            <m.span
              className="w-1.5 h-1.5 rounded-full bg-modulo-gestao-strong"
              animate={reduced ? undefined : { opacity: [1, 0.35, 1], scale: [1, 0.8, 1] }}
              transition={{ duration: 1.7, ...LOOP }}
            />
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
  return <DiarioScreen />;
}

import { m } from "framer-motion";
import { EASE } from "../../lib/motion";
import type { ModuloSlug } from "../../lib/modules";

/**
 * Miniaturas do produto no topo de cada card de módulo.
 *
 * Antes o card era só texto, e a seção inteira virava uma parede de listas com
 * check. A miniatura dá uma pista visual do que o módulo é antes de o visitante
 * ler qualquer palavra (SPEC 060).
 *
 * Cada uma anima ao entrar em vista com a coreografia do próprio módulo: o
 * funil desloca cartões, o cronograma desenha barras, o diário preenche linhas.
 */

const VISTA = { once: true, amount: 0.5 } as const;

function MiniFunil() {
  const colunas = [
    { rotulo: "Contato", alturas: [26, 20], tom: "bg-paper-border" },
    { rotulo: "Proposta", alturas: [26], tom: "bg-modulo-gestao" },
    { rotulo: "Ganho", alturas: [26, 26], tom: "bg-modulo-gestao" },
  ];

  return (
    <div className="flex gap-1.5 h-full items-start">
      {colunas.map((coluna, c) => (
        <div key={coluna.rotulo} className="flex-1 flex flex-col gap-1.5">
          <span className="text-[7px] uppercase tracking-[0.09em] text-ink-muted">{coluna.rotulo}</span>
          {coluna.alturas.map((h, i) => (
            <m.span
              key={i}
              className={`rounded ${coluna.tom} w-full`}
              style={{ height: h }}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={VISTA}
              transition={{ duration: 0.5, delay: 0.1 + c * 0.12 + i * 0.06, ease: EASE.out }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function MiniCronograma() {
  const barras = [
    { inicio: 0, largura: 0.55, rotulo: "Estrutural" },
    { inicio: 0.22, largura: 0.5, rotulo: "Elétrico" },
    { inicio: 0.44, largura: 0.48, rotulo: "Climatização" },
  ];

  return (
    <div className="flex flex-col justify-center gap-2.5 h-full">
      {barras.map((b, i) => (
        <div key={b.rotulo} className="flex items-center gap-2">
          <span className="text-[7.5px] text-ink-muted w-[48px] shrink-0 truncate">{b.rotulo}</span>
          <span className="relative flex-1 h-2 rounded-full bg-paper-alt overflow-hidden">
            <m.span
              className="absolute top-0 h-full rounded-full bg-modulo-projetos origin-left"
              style={{ left: `${b.inicio * 100}%`, width: `${b.largura * 100}%` }}
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={VISTA}
              transition={{ duration: 0.7, delay: 0.15 + i * 0.13, ease: EASE.out }}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

function MiniDiario() {
  const linhas = [
    ["Clima", "Nublado"],
    ["Efetivo", "14"],
    ["Medição", "62 m²"],
  ];

  return (
    <div className="flex flex-col justify-center gap-1.5 h-full">
      {linhas.map(([k, v], i) => (
        <m.div
          key={k}
          className="flex justify-between items-center rounded bg-paper-alt px-2 py-[5px]"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VISTA}
          transition={{ duration: 0.45, delay: 0.12 + i * 0.11, ease: EASE.out }}
        >
          <span className="text-[7.5px] uppercase tracking-[0.08em] text-ink-muted">{k}</span>
          <span className="text-[9px] text-ink">{v}</span>
        </m.div>
      ))}
      <m.div
        className="flex items-center gap-1.5 mt-0.5"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={VISTA}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-modulo-obra-strong" />
        <span className="text-[7.5px] text-ink-muted">Sincronizado com o escritório</span>
      </m.div>
    </div>
  );
}

export function ModuleMiniature({ slug }: { slug: ModuloSlug }) {
  return (
    <div className="h-[104px] rounded-lg border border-paper-border/60 bg-white p-2.5 mb-5" aria-hidden="true">
      {slug === "gestao" && <MiniFunil />}
      {slug === "projetos" && <MiniCronograma />}
      {slug === "obra" && <MiniDiario />}
    </div>
  );
}

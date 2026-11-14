/**
 * Visual único dos Gantt (Obra, Projetos, Cronograma por projeto). A matemática vem de
 * `@/lib/cronograma` e o arrasto de `useGanttDrag`; aqui vive só o que é aparência,
 * para o cronograma ter a mesma cara em toda tela (SPEC 041).
 */

/** Coluna de rótulos à esquerda: mais estreita no mobile para sobrar espaço à linha do tempo. */
export const GANTT_LABEL_W = "w-[112px] md:w-[240px]";

/** Linha vertical que acompanha o cursor no arrasto e a etiqueta com a data no topo dela. */
export const GANTT_GUIDE_LINE = "absolute top-0 bottom-0 z-30 w-px bg-chart-info/70 pointer-events-none";
export const GANTT_GUIDE_CHIP =
  "absolute top-1 left-2 whitespace-nowrap rounded bg-chart-info px-1.5 py-0.5 text-[10px] font-medium text-white shadow-md";

/** Dica flutuante durante o arrasto (ex.: "12 dias"). */
export const GANTT_DRAG_TIP =
  "whitespace-nowrap rounded-md bg-ink/90 px-2 py-1 text-[10px] font-medium text-white shadow-lg";

/** Moldura do gráfico. */
export const GANTT_FRAME = "overflow-hidden rounded-lg border bg-card shadow-sm";

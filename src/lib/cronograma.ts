/**
 * Matemática de linha do tempo (Gantt), pura e sem React. Compartilhada pelo
 * cronograma de projetos (todos os projetos numa timeline) e pelo cronograma
 * da obra (frentes numa timeline, spec 020). Datas entram como "YYYY-MM-DD" e
 * são ancoradas ao meio-dia local para não escorregar de fuso.
 */

export type ZoomLevel = "months" | "weeks";

/** Cor por status de disciplina, usada pelo cronograma do projeto e pelo cronograma agregado. */
export const DISCIPLINA_STATUS_COLORS: Record<string, { bar: string; text: string; bg: string }> = {
  Concluído: { bar: "bg-positive/100", text: "text-positive-strong", bg: "bg-positive/10" },
  "Em Andamento": { bar: "bg-status-progress", text: "text-info-strong", bg: "bg-info-soft" },
  Pendente: { bar: "bg-status-planning", text: "text-warning-mid", bg: "bg-warning-soft" },
  "Não Iniciado": { bar: "bg-status-unknown", text: "text-ink-muted", bg: "bg-muted" },
};

export interface TimelineColumn {
  label: string;
  start: Date;
  end: Date;
}

export function parseDate(d: string | undefined | null): Date | null {
  if (!d) return null;
  const date = new Date(d + "T00:00:00");
  return isNaN(date.getTime()) ? null : date;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

/** Data → "YYYY-MM-DD" (local), para gravar no banco após um drag. */
export function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Tolerância curta de propósito: só gruda quando solta bem em cima da borda do
// mês/semana. Valor maior fazia o arraste "travar" vários dias antes de saltar
// pra data real (ex.: 4 dias fazia parecer que ia de 01/09 direto pro 06/09).
const SNAP_BOUNDARY_MONTHS = 1;
const SNAP_BOUNDARY_WEEKS = 1;

/**
 * Encaixa uma data na borda de mês/semana quando o drag chega perto dela, para
 * o usuário conseguir "grudar" no início do mês/semana sem mirar pixel a pixel.
 */
export function snapToBoundary(date: Date, zoom: ZoomLevel): Date {
  if (zoom === "months") {
    const som = startOfMonth(date);
    const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    if (Math.abs(diffDays(som, date)) <= SNAP_BOUNDARY_MONTHS) return som;
    if (Math.abs(diffDays(nextMonth, date)) <= SNAP_BOUNDARY_MONTHS) return nextMonth;
  } else {
    const sow = startOfWeek(date);
    const nextWeek = addDays(sow, 7);
    if (Math.abs(diffDays(sow, date)) <= SNAP_BOUNDARY_WEEKS) return sow;
    if (Math.abs(diffDays(nextWeek, date)) <= SNAP_BOUNDARY_WEEKS) return nextWeek;
  }
  return date;
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

export function formatWeekLabel(date: Date): string {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Colunas do cabeçalho da timeline, por mês ou por semana, cobrindo [start, end]. */
export function generateColumns(timelineStart: Date, timelineEnd: Date, zoom: ZoomLevel): TimelineColumn[] {
  const cols: TimelineColumn[] = [];
  if (zoom === "months") {
    let current = startOfMonth(timelineStart);
    while (current <= timelineEnd) {
      const monthEnd = endOfMonth(current);
      cols.push({
        label: formatMonthYear(current),
        start: new Date(current),
        end: monthEnd > timelineEnd ? new Date(timelineEnd) : monthEnd,
      });
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }
  } else {
    let current = startOfWeek(timelineStart);
    while (current <= timelineEnd) {
      const weekEnd = addDays(current, 6);
      cols.push({
        label: formatWeekLabel(current),
        start: new Date(current),
        end: weekEnd > timelineEnd ? new Date(timelineEnd) : weekEnd,
      });
      current = addDays(current, 7);
    }
  }
  return cols;
}

/**
 * Posição de uma barra na timeline, em % da largura total. `left` nunca fica
 * negativo e `width` é cortado para não estourar o fim (mínimo 1%).
 */
export function barPosition(
  start: Date,
  end: Date,
  timelineStart: Date,
  timelineEnd: Date
): { leftPct: number; widthPct: number } {
  const totalDays = diffDays(timelineStart, timelineEnd);
  if (totalDays <= 0) return { leftPct: 0, widthPct: 0 };
  const leftPct = Math.max(0, (diffDays(timelineStart, start) / totalDays) * 100);
  let widthPct = Math.max(1, (diffDays(start, end) / totalDays) * 100);
  if (leftPct + widthPct > 100) widthPct = 100 - leftPct;
  return { leftPct, widthPct };
}

export type GanttDragType = "left" | "right" | "move";

/**
 * Novas datas de uma barra após arrastar `deltaDays` dias. Redimensiona pela
 * borda (left/right) ou move a barra inteira, garante duração mínima de 1 dia,
 * e encaixa a borda arrastada na fronteira de mês/semana (snap). Pura e testável
 * — a restrição de negócio (ex. guarda-chuva do projeto) é aplicada por fora.
 */
export function computeDraggedDates(
  origStart: Date,
  origEnd: Date,
  deltaDays: number,
  type: GanttDragType,
  zoom: ZoomLevel
): { start: Date; end: Date } {
  let start = new Date(origStart);
  let end = new Date(origEnd);

  if (type === "left") {
    start = addDays(origStart, deltaDays);
    if (start >= end) start = addDays(end, -1);
    start = snapToBoundary(start, zoom);
  } else if (type === "right") {
    end = addDays(origEnd, deltaDays);
    if (end <= start) end = addDays(start, 1);
    end = snapToBoundary(end, zoom);
  } else {
    start = addDays(origStart, deltaDays);
    end = addDays(origEnd, deltaDays);
  }

  return { start, end };
}

/** Posição do "Hoje" em % da timeline; -1 quando hoje está fora do intervalo. */
export function todayPosition(timelineStart: Date, timelineEnd: Date, hoje = new Date()): number {
  const today = startOfDay(hoje);
  const totalDays = diffDays(timelineStart, timelineEnd);
  if (totalDays <= 0) return -1;
  const pct = (diffDays(timelineStart, today) / totalDays) * 100;
  return pct >= 0 && pct <= 100 ? pct : -1;
}

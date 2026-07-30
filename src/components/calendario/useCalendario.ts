import { useCallback, useMemo, useState } from "react";
import { type CamadaId, type CamadasVisiveis, MESES, startOfMonth, startOfWeek, addDays } from "./eventos";

export type CalendarioView = "mes" | "semana" | "agenda";

export const VIEW_LABEL: Record<CalendarioView, string> = {
  mes: "Mês",
  semana: "Semana",
  agenda: "Agenda",
};

/** Rótulo do período visível, conforme a visão (semana mostra intervalo). */
export function labelPeriodo(view: CalendarioView, cursor: Date): string {
  if (view === "semana") {
    const ws = startOfWeek(cursor);
    const we = addDays(ws, 6);
    const abrev = (d: Date) => `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`;
    return `${abrev(ws)} – ${abrev(we)}, ${we.getFullYear()}`;
  }
  return `${MESES[cursor.getMonth()]} ${cursor.getFullYear()}`;
}

/** Estado de navegação do calendário (cursor + visão), partilhado pelos mounts. */
export function useCalendarioNav(inicial?: Partial<{ view: CalendarioView }>) {
  const [cursor, setCursor] = useState<Date>(startOfMonth(new Date()));
  const [view, setView] = useState<CalendarioView>(inicial?.view ?? "mes");

  const step = useCallback(
    (dir: number) => {
      setCursor((c) => (view === "semana" ? addDays(c, dir * 7) : new Date(c.getFullYear(), c.getMonth() + dir, 1)));
    },
    [view]
  );

  const goHoje = useCallback(() => {
    setCursor(view === "semana" ? new Date() : startOfMonth(new Date()));
  }, [view]);

  return { cursor, setCursor, view, setView, step, goHoje };
}

/** Estado dos toggles "Meus calendários". `defaults` liga/desliga cada camada. */
export function useCamadasVisiveis(defaults: CamadasVisiveis) {
  const [visiveis, setVisiveis] = useState<CamadasVisiveis>(defaults);
  const toggle = useCallback((id: CamadaId, valor: boolean) => {
    setVisiveis((v) => ({ ...v, [id]: valor }));
  }, []);
  return { visiveis, toggle };
}

/** Conjunto de dias (YYYY-MM-DD) que têm evento, para marcar no mini-mês. */
export function useDiasComEvento(eventosPorDia: Map<string, unknown>): Set<string> {
  return useMemo(() => new Set(eventosPorDia.keys()), [eventosPorDia]);
}

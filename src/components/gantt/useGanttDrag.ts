import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  addDays,
  barPosition,
  computeDraggedDates,
  diffDays,
  formatWeekLabel,
  toIso,
  type GanttDragType,
  type ZoomLevel,
} from "@/lib/cronograma";

interface DragRow {
  start: Date | null;
  end: Date | null;
}

interface DragState {
  rowIdx: number;
  type: GanttDragType;
  startX: number;
  origStart: Date;
  origEnd: Date;
}

export interface DragOverride {
  rowIdx: number;
  start: Date;
  end: Date;
  type: GanttDragType;
  snapping: boolean;
}

export interface ConstrainResult {
  start: Date;
  end: Date;
  snapping: boolean;
}

interface UseGanttDragOptions<TRow extends DragRow> {
  rows: TRow[];
  timelineStart: Date;
  timelineEnd: Date;
  zoom: ZoomLevel;
  /** Habilita o arraste (tipicamente `!!onDatesChange`). */
  enabled: boolean;
  timelineRef: RefObject<HTMLElement | null>;
  scrollRef: RefObject<HTMLElement | null>;
  /**
   * Restrição de negócio aplicada após o cálculo bruto das datas (ex.:
   * guarda-chuva que trava a barra dentro das datas do projeto). Retorna
   * `snapping: true` quando clampou, o que suprime o commit se
   * `skipCommitWhenSnapping` estiver ligado.
   */
  constrain?: (dates: { start: Date; end: Date; type: GanttDragType }) => ConstrainResult;
  /** Persiste as novas datas ao soltar. */
  onCommit: (rowIdx: number, dates: { start: Date; end: Date }) => Promise<void>;
  /** Não persiste quando a barra foi clampada pela restrição. Padrão: false. */
  skipCommitWhenSnapping?: boolean;
}

/**
 * Motor de arraste do Gantt, compartilhado pelos cronogramas (projeto, todos os
 * projetos, obra). Encapsula os refs de drag, os listeners de mouse/touch/Escape,
 * o snap de borda, a linha-guia e o commit. O JSX de cada tela fica por fora; só
 * a mecânica (a parte sutil e duplicada) mora aqui. Ver ADR 0020 / SPEC 041.
 */
export function useGanttDrag<TRow extends DragRow>({
  rows,
  timelineStart,
  timelineEnd,
  zoom,
  enabled,
  timelineRef,
  scrollRef,
  constrain,
  onCommit,
  skipCommitWhenSnapping = false,
}: UseGanttDragOptions<TRow>) {
  const dragRef = useRef<DragState | null>(null);
  const [override, setOverride] = useState<DragOverride | null>(null);
  const [guideX, setGuideX] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Marca que a barra realmente mudou de data no arraste, pra o clique de soltar
  // não disparar a navegação/edição logo em seguida.
  const draggedRef = useRef(false);

  // Refs espelham props/estado mutáveis para os listeners não re-assinarem a cada render.
  const zoomRef = useRef(zoom);
  const overrideRef = useRef(override);
  const constrainRef = useRef(constrain);
  const onCommitRef = useRef(onCommit);
  const rowsRef = useRef(rows);
  zoomRef.current = zoom;
  overrideRef.current = override;
  constrainRef.current = constrain;
  onCommitRef.current = onCommit;
  rowsRef.current = rows;

  const pxPerDay = useCallback((): number => {
    if (!timelineRef.current) return 1;
    const totalDays = diffDays(timelineStart, timelineEnd);
    return totalDays > 0 ? timelineRef.current.offsetWidth / totalDays : 1;
  }, [timelineStart, timelineEnd, timelineRef]);

  const startDrag = useCallback(
    (clientX: number, rowIdx: number, type: GanttDragType) => {
      if (!enabled) return;
      const row = rowsRef.current[rowIdx];
      if (!row?.start || !row?.end) return;
      draggedRef.current = false;
      dragRef.current = {
        rowIdx,
        type,
        startX: clientX,
        origStart: new Date(row.start),
        origEnd: new Date(row.end),
      };
    },
    [enabled]
  );

  useEffect(() => {
    const reset = () => {
      dragRef.current = null;
      setOverride(null);
      setGuideX(null);
    };

    const apply = (clientX: number) => {
      const drag = dragRef.current;
      if (!drag) return;

      const deltaDays = Math.round((clientX - drag.startX) / pxPerDay());
      let { start, end } = computeDraggedDates(drag.origStart, drag.origEnd, deltaDays, drag.type, zoomRef.current);

      let snapping = false;
      const c = constrainRef.current;
      if (c) {
        const r = c({ start, end, type: drag.type });
        start = r.start;
        end = r.end;
        snapping = r.snapping;
      }

      if (toIso(start) !== toIso(drag.origStart) || toIso(end) !== toIso(drag.origEnd)) {
        draggedRef.current = true;
      }
      setOverride({ rowIdx: drag.rowIdx, start, end, type: drag.type, snapping });
    };

    const trackGuide = (clientX: number) => {
      if (timelineRef.current && scrollRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        setGuideX(Math.max(0, clientX - rect.left + scrollRef.current.scrollLeft));
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      trackGuide(e.clientX);
      apply(e.clientX);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();
      const touch = e.touches[0];
      trackGuide(touch.clientX);
      apply(touch.clientX);
    };

    const commit = async () => {
      const drag = dragRef.current;
      const ov = overrideRef.current;
      const wasSnapping = ov?.snapping ?? false;
      reset();

      if (!drag || !ov) return;
      if (skipCommitWhenSnapping && wasSnapping) return;
      if (toIso(ov.start) === toIso(drag.origStart) && toIso(ov.end) === toIso(drag.origEnd)) return;

      setIsSaving(true);
      try {
        await onCommitRef.current(ov.rowIdx, { start: ov.start, end: ov.end });
      } finally {
        setIsSaving(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dragRef.current) reset();
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", commit);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", commit);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", commit);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", commit);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pxPerDay, skipCommitWhenSnapping, timelineRef, scrollRef]);

  /** Geometria (%), com a sobreposição do arraste quando a linha está sendo arrastada. */
  const getBarGeometry = (rowIdx: number) => {
    const ov = override?.rowIdx === rowIdx ? override : null;
    const start = ov ? ov.start : rows[rowIdx]?.start;
    const end = ov ? ov.end : rows[rowIdx]?.end;
    if (!start || !end) return null;
    const { leftPct, widthPct } = barPosition(start, end, timelineStart, timelineEnd);
    return { leftPct, widthPct, start, end };
  };

  /** Data sob o cursor durante o arraste, curta (dd/mm). */
  const guideDateLabel = (): string => {
    if (guideX === null || !timelineRef.current) return "";
    const totalWidth = timelineRef.current.offsetWidth;
    if (totalWidth <= 0) return "";
    const totalDays = diffDays(timelineStart, timelineEnd);
    const dayOffset = Math.round((guideX / totalWidth) * totalDays);
    return formatWeekLabel(addDays(timelineStart, Math.max(0, Math.min(totalDays, dayOffset))));
  };

  /**
   * Deve suprimir o clique que acontece ao soltar o arraste? Consome a flag (a
   * reseta), pra o próximo clique real passar.
   */
  const shouldSuppressClick = (): boolean => {
    if (dragRef.current || draggedRef.current) {
      draggedRef.current = false;
      return true;
    }
    return false;
  };

  return {
    override,
    guideX,
    isSaving,
    isDragging: dragRef.current !== null || override !== null,
    startDrag,
    getBarGeometry,
    guideDateLabel,
    shouldSuppressClick,
  };
}

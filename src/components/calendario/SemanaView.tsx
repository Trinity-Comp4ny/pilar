import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type PrazoEvento, WEEKDAYS, fmtKey, todayKey, startOfWeek, addDays } from "./eventos";
import { EventoChip } from "./EventoItem";

interface SemanaViewProps {
  cursor: Date;
  eventosPorDia: Map<string, PrazoEvento[]>;
  onEventoClick: (evento: PrazoEvento) => void;
}

export function SemanaView({ cursor, eventosPorDia, onEventoClick }: SemanaViewProps) {
  const dias = useMemo(() => {
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor]);

  return (
    <Card>
      <CardContent className="p-0">
        <div className="grid grid-cols-7 divide-x">
          {dias.map((d, idx) => {
            const key = fmtKey(d);
            const eventosDoDia = eventosPorDia.get(key) || [];
            const isToday = key === todayKey();
            const isFimDeSemana = d.getDay() === 0 || d.getDay() === 6;

            return (
              <div key={idx} className={cn("min-h-[420px] flex flex-col", isFimDeSemana && "bg-muted/20")}>
                <div
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2 border-b sticky top-0 bg-inherit",
                    isToday && "bg-brand/5"
                  )}
                >
                  <span className="text-[11px] font-medium text-muted-foreground uppercase">{WEEKDAYS[idx]}</span>
                  <span
                    className={cn(
                      "text-sm",
                      isToday
                        ? "bg-brand text-ink rounded-full w-7 h-7 flex items-center justify-center font-semibold"
                        : "text-ink"
                    )}
                  >
                    {d.getDate()}
                  </span>
                </div>
                <div className="flex-1 p-1.5 space-y-1 overflow-y-auto">
                  {eventosDoDia.length === 0 ? (
                    <div className="text-[10px] text-muted-foreground/50 text-center pt-4" aria-hidden>
                      —
                    </div>
                  ) : (
                    eventosDoDia.map((e, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onEventoClick(e)}
                        className="block w-full text-left hover:opacity-80 transition-opacity"
                        title="Abrir"
                      >
                        <EventoChip evento={e} />
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

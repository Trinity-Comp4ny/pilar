import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { type PrazoEvento, WEEKDAYS, fmtKey, todayKey, startOfMonth, endOfMonth, weekdayIndex } from "./eventos";
import { EventoChip, EventoDetalhe } from "./EventoItem";

interface MesViewProps {
  cursor: Date;
  eventosPorDia: Map<string, PrazoEvento[]>;
  onEventoClick: (evento: PrazoEvento) => void;
}

export function MesView({ cursor, eventosPorDia, onEventoClick }: MesViewProps) {
  const dias = useMemo(() => {
    const start = startOfMonth(cursor);
    const end = endOfMonth(cursor);
    const startWeekday = weekdayIndex(start);
    const totalDays = end.getDate();

    const grid: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) grid.push(null);
    for (let d = 1; d <= totalDays; d++) grid.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (grid.length % 7 !== 0) grid.push(null);
    return grid;
  }, [cursor]);

  return (
    <Card>
      <CardContent className="p-0">
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="text-[11px] font-medium text-muted-foreground p-2 text-center">
              {wd}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {dias.map((d, idx) => {
            if (!d) return <div key={idx} className="min-h-[100px] border-r border-b bg-muted/10" />;
            const key = fmtKey(d);
            const eventosDoDia = eventosPorDia.get(key) || [];
            const isToday = key === todayKey();
            const isFimDeSemana = d.getDay() === 0 || d.getDay() === 6;

            return (
              <Popover key={idx}>
                <PopoverTrigger asChild disabled={eventosDoDia.length === 0}>
                  <button
                    type="button"
                    className={cn(
                      "min-h-[100px] border-r border-b p-1.5 text-left transition-colors",
                      isFimDeSemana && "bg-muted/20",
                      isToday && "bg-brand/5",
                      eventosDoDia.length > 0 && "hover:bg-muted/40 cursor-pointer"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={cn(
                          "text-xs",
                          isToday
                            ? "bg-brand text-ink rounded-full w-5 h-5 flex items-center justify-center font-semibold"
                            : "text-muted-foreground"
                        )}
                      >
                        {d.getDate()}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {eventosDoDia.slice(0, 3).map((e, i) => (
                        <EventoChip key={i} evento={e} />
                      ))}
                      {eventosDoDia.length > 3 && (
                        <div className="text-[11px] text-muted-foreground px-1.5">+{eventosDoDia.length - 3} mais</div>
                      )}
                    </div>
                  </button>
                </PopoverTrigger>
                {eventosDoDia.length > 0 && (
                  <PopoverContent align="start" className="w-80 p-3">
                    <div className="text-xs font-medium mb-2">
                      {d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
                    </div>
                    <div className="space-y-2">
                      {eventosDoDia.map((e, i) => (
                        <EventoDetalhe key={i} evento={e} onOpen={() => onEventoClick(e)} />
                      ))}
                    </div>
                  </PopoverContent>
                )}
              </Popover>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

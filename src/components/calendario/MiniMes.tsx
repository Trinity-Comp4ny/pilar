import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtKey, todayKey, startOfMonth, endOfMonth, weekdayIndex, MESES } from "./eventos";

const MINI_WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"];

interface MiniMesProps {
  /** Dia selecionado (deriva o mês exibido inicialmente). */
  selecionado: Date;
  /** Dias com pelo menos um evento (chaves YYYY-MM-DD), para marcar com ponto. */
  diasComEvento: Set<string>;
  onSelectDate: (d: Date) => void;
}

export function MiniMes({ selecionado, diasComEvento, onSelectDate }: MiniMesProps) {
  const [mes, setMes] = useState<Date>(startOfMonth(selecionado));

  const dias = useMemo(() => {
    const start = startOfMonth(mes);
    const total = endOfMonth(mes).getDate();
    const offset = weekdayIndex(start);
    const grid: (Date | null)[] = [];
    for (let i = 0; i < offset; i++) grid.push(null);
    for (let d = 1; d <= total; d++) grid.push(new Date(mes.getFullYear(), mes.getMonth(), d));
    while (grid.length % 7 !== 0) grid.push(null);
    return grid;
  }, [mes]);

  const selKey = fmtKey(selecionado);
  const hoje = todayKey();

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-ink">
          {MESES[mes.getMonth()]} {mes.getFullYear()}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}
            className="h-6 w-6 grid place-items-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}
            className="h-6 w-6 grid place-items-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {MINI_WEEKDAYS.map((wd, i) => (
          <div key={i} className="text-[10px] text-muted-foreground text-center h-6 grid place-items-center">
            {wd}
          </div>
        ))}
        {dias.map((d, idx) => {
          if (!d) return <div key={idx} className="h-7" />;
          const key = fmtKey(d);
          const isSel = key === selKey;
          const isToday = key === hoje;
          const temEvento = diasComEvento.has(key);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectDate(d)}
              className={cn(
                "relative h-7 w-7 mx-auto grid place-items-center rounded-full text-xs transition-colors",
                isSel ? "bg-brand text-ink font-semibold" : "hover:bg-muted text-ink",
                !isSel && isToday && "font-semibold text-ink ring-1 ring-brand"
              )}
              aria-label={d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}
              aria-current={isToday ? "date" : undefined}
            >
              {d.getDate()}
              {temEvento && !isSel && (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-muted-foreground/60" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

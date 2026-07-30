import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";
import { type PrazoEvento, fmtKey, startOfMonth, endOfMonth, MESES } from "./eventos";
import { EventoDetalhe } from "./EventoItem";

interface AgendaViewProps {
  cursor: Date;
  eventos: PrazoEvento[];
  onEventoClick: (evento: PrazoEvento) => void;
}

export function AgendaView({ cursor, eventos, onEventoClick }: AgendaViewProps) {
  const grupos = useMemo(() => {
    const de = fmtKey(startOfMonth(cursor));
    const ate = fmtKey(endOfMonth(cursor));
    const doMes = eventos.filter((e) => e.data >= de && e.data <= ate).sort((a, b) => a.data.localeCompare(b.data));

    const map = new Map<string, PrazoEvento[]>();
    for (const e of doMes) {
      const arr = map.get(e.data) || [];
      arr.push(e);
      map.set(e.data, arr);
    }
    return Array.from(map.entries());
  }, [eventos, cursor]);

  if (grupos.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Nenhum prazo em {MESES[cursor.getMonth()]} de {cursor.getFullYear()}.
          </p>
          <p className="text-xs text-muted-foreground/70">Ajuste os filtros ou navegue para outro mês.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0 divide-y">
        {grupos.map(([dia, eventosDoDia]) => {
          const d = new Date(`${dia}T00:00:00`);
          return (
            <div key={dia} className="flex gap-4 p-4">
              <div className="w-28 shrink-0">
                <div className="text-sm font-medium text-ink capitalize">
                  {d.toLocaleDateString("pt-BR", { weekday: "long" })}
                </div>
                <div className="text-xs text-muted-foreground">
                  {d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}
                </div>
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                {eventosDoDia.map((e, i) => (
                  <EventoDetalhe key={i} evento={e} onOpen={() => onEventoClick(e)} />
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

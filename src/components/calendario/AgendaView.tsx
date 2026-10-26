import { useMemo, useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type PrazoEvento, fmtKey, startOfMonth, endOfMonth, MESES } from "./eventos";
import { EventoDetalhe } from "./EventoItem";

interface AgendaViewProps {
  cursor: Date;
  eventos: PrazoEvento[];
  onEventoClick: (evento: PrazoEvento) => void;
  /**
   * Quando existe, a lista traz todos os dias do mês (inclusive os vazios), cada um com o botão
   * "+ Tarefa" que abre este conteúdo (criar algo naquele dia).
   */
  renderNovoNoDia?: (dia: Date, fechar: () => void) => ReactNode;
}

export function AgendaView({ cursor, eventos, onEventoClick, renderNovoNoDia }: AgendaViewProps) {
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const grupos = useMemo(() => {
    const de = fmtKey(startOfMonth(cursor));
    const ate = fmtKey(endOfMonth(cursor));
    const doMes = eventos.filter((e) => e.data >= de && e.data <= ate).sort((a, b) => a.data.localeCompare(b.data));

    const map = new Map<string, PrazoEvento[]>();
    if (renderNovoNoDia) {
      for (let dia = 1; dia <= endOfMonth(cursor).getDate(); dia++) {
        map.set(fmtKey(new Date(cursor.getFullYear(), cursor.getMonth(), dia)), []);
      }
    }
    for (const e of doMes) {
      const arr = map.get(e.data) || [];
      arr.push(e);
      map.set(e.data, arr);
    }
    return Array.from(map.entries());
  }, [eventos, cursor, renderNovoNoDia]);

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
                {renderNovoNoDia && (
                  <Popover open={diaAberto === dia} onOpenChange={(aberto) => setDiaAberto(aberto ? dia : null)}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="mt-2 h-8">
                        <Plus className="mr-1 h-3.5 w-3.5" /> Tarefa
                        <span className="sr-only">
                          em {d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" collisionPadding={12} className="w-80 max-w-[calc(100vw-2rem)] p-3">
                      {renderNovoNoDia(d, () => setDiaAberto(null))}
                    </PopoverContent>
                  </Popover>
                )}
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

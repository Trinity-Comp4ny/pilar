import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, Check, AlertTriangle, Clock, DollarSign } from "lucide-react";
import {
  useAlertas,
  useAlertasNaoLidos,
  useMarcarAlertaLido,
  useMarcarTodosLidos,
  SEVERIDADE_CONFIG,
} from "@/hooks/useAlertas";

const TIPO_ICON: Record<string, typeof AlertTriangle> = {
  horas_excedidas: Clock,
  pagamento_atrasado: DollarSign,
  superalocacao: AlertTriangle,
  margem_baixa: AlertTriangle,
  marco_proximo: Clock,
  orcamento_excedido: AlertTriangle,
};

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function AlertsBell() {
  const { data: alertas = [] } = useAlertas(10);
  const { data: naoLidos = 0 } = useAlertasNaoLidos();
  const marcarLido = useMarcarAlertaLido();
  const marcarTodos = useMarcarTodosLidos();
  const [open, setOpen] = useState(false);

  const handleMarcarLido = (id: string) => {
    marcarLido.mutate(id);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {naoLidos > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-chart-danger text-[10px] font-bold text-white flex items-center justify-center">
              {naoLidos > 9 ? "9+" : naoLidos}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="text-sm font-semibold">Alertas</h4>
          {naoLidos > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => marcarTodos.mutate()}>
              <Check className="h-3 w-3 mr-1" />
              Marcar todos como lidos
            </Button>
          )}
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {alertas.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Nenhum alerta</div>
          ) : (
            alertas.map((alerta) => {
              const Icon = TIPO_ICON[alerta.tipo] || AlertTriangle;
              const sevConfig = SEVERIDADE_CONFIG[alerta.severidade];

              return (
                <div
                  key={alerta.id}
                  className={`px-4 py-3 border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors ${
                    !alerta.lido ? "bg-info-soft/50" : ""
                  }`}
                  onClick={() => !alerta.lido && handleMarcarLido(alerta.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 p-1 rounded ${sevConfig.color}`}>
                      <Icon className="h-3 w-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={`text-xs font-medium truncate ${!alerta.lido ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {alerta.titulo}
                        </p>
                        {!alerta.lido && <span className="h-1.5 w-1.5 rounded-full bg-chart-info shrink-0" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{alerta.mensagem}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{formatTimeAgo(alerta.created_at)}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

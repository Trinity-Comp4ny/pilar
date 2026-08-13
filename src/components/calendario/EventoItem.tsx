import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { type PrazoEvento, type CamadaId, CAMADA_REGISTRY, ESTADO_CHIP, ESTADO_SIMBOLO, ESTADO_LABEL } from "./eventos";

/** Chip compacto de um evento dentro de uma célula de dia (Mês/Semana).
 * Cor = estado (urgência); ícone (forma) = camada. Uma cor só por chip mantém a
 * leitura de "o que precisa de ação" limpa; o símbolo é o rótulo não-cromático
 * do estado (a11y para daltônicos). */
export function EventoChip({ evento }: { evento: PrazoEvento }) {
  const camada = CAMADA_REGISTRY[evento.camada];
  const CamadaIcon = camada.icon;
  return (
    <div
      title={`${ESTADO_LABEL[evento.estado]} · ${camada.label}`}
      className={cn("flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border-l-2", ESTADO_CHIP[evento.estado])}
    >
      <span aria-hidden className="font-semibold">
        {ESTADO_SIMBOLO[evento.estado]}
      </span>
      <CamadaIcon aria-label={camada.label} className="h-3 w-3 shrink-0" />
      <span className="truncate">{evento.titulo}</span>
    </div>
  );
}

/** Linha clicável de evento (popover do dia e visão Agenda). */
export function EventoDetalhe({ evento, onOpen }: { evento: PrazoEvento; onOpen: () => void }) {
  const camada = CAMADA_REGISTRY[evento.camada];
  const CamadaIcon = camada.icon;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full text-left p-2 rounded hover:bg-muted/50 border flex items-center gap-2"
      title="Abrir"
    >
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <CamadaIcon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium truncate">{evento.titulo}</span>
            {evento.estado === "atrasado" && (
              <Badge variant="destructive" className="text-[10px] px-1 py-0">
                atraso
              </Badge>
            )}
            {evento.estado === "proximo" && (
              <Badge className="text-[10px] px-1 py-0 bg-fill-warning hover:bg-fill-warning text-fill-warning-foreground">próximo</Badge>
            )}
            {evento.estado === "concluido" && (
              <Badge className="text-[10px] px-1 py-0 bg-positive hover:bg-positive text-ink">OK</Badge>
            )}
          </div>
          {evento.subtitulo && <div className="text-[10px] text-muted-foreground truncate">{evento.subtitulo}</div>}
          {evento.responsavel && <div className="text-[10px] text-muted-foreground truncate">{evento.responsavel}</div>}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />
    </button>
  );
}

/** Legenda de estados e das camadas visíveis, partilhada pelas visões. */
export function CalendarioLegenda({ camadas }: { camadas: CamadaId[] }) {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-chart-danger" /> Em atraso
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-chart-warning" /> Próximos 7 dias
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-chart-info" /> Futuro
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-positive" /> Concluído
      </div>
      <div className="flex items-center gap-3 ml-auto">
        {camadas.map((id) => {
          const c = CAMADA_REGISTRY[id];
          const Icon = c.icon;
          return (
            <span key={id} className="flex items-center gap-1">
              <Icon className="h-3 w-3" /> {c.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

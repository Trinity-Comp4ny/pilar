import { AlertTriangle, Calendar, Clock, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PROJECT_STATUS_CONFIG } from "@/constants";
import { cn } from "@/lib/utils";
import {
  type DisciplinaResponsavel,
  type Projeto,
  formatDateShort,
  getDiscDeadlineStatus,
  getResponsaveisList,
} from "@/types/projetos";
import { DisciplinaStatusBadge } from "./DisciplinaStatusBadge";

/** Uma disciplina dentro de um projeto: o status em destaque é o da DISCIPLINA; o do projeto vem rotulado à parte. */
export function DisciplinaProjetoLinha({
  projeto,
  disciplina,
}: {
  projeto: Projeto;
  disciplina: DisciplinaResponsavel;
}) {
  const dlStatus = getDiscDeadlineStatus(disciplina);
  const atrasada = dlStatus?.status_data === "em_atraso";
  const atencao = dlStatus?.status_data === "atencao";
  const resps = getResponsaveisList(disciplina).filter((r) => r.responsavel_nome);
  const projStatus = PROJECT_STATUS_CONFIG[projeto.status];
  const concluida = disciplina.status === "Concluído" || !!disciplina.data_final;
  const horasEst = disciplina.horas_estimadas ?? 0;
  const horasReal = disciplina.horas_realizadas ?? 0;

  return (
    <div
      className={cn(
        "px-4 py-3 pl-11 grid gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.3fr)] sm:items-start transition-colors hover:bg-muted/20",
        atrasada && "bg-danger-soft/30",
        atencao && "bg-warning-soft/30"
      )}
    >
      <div className="min-w-0">
        <span className="font-medium text-sm truncate block">{projeto.nome}</span>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
          {projStatus && (
            <span className="flex items-center gap-1">
              Projeto:
              <span className={cn("font-medium", projStatus.color)}>{projStatus.label}</span>
            </span>
          )}
          {projeto.cliente_nome && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="truncate">{projeto.cliente_nome}</span>
            </>
          )}
        </div>
      </div>

      <div className="text-xs flex items-start gap-1 min-w-0">
        <User className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
        <span className={cn("truncate", resps.length === 0 && "text-muted-foreground")}>
          {resps.length > 0 ? resps.map((r) => r.responsavel_nome).join(", ") : "Sem responsável"}
        </span>
      </div>

      <div className="text-xs space-y-0.5">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>
            {disciplina.data_inicio ? formatDateShort(disciplina.data_inicio) : "—"} →{" "}
            <span className={cn(atrasada && "text-danger-mid font-medium")}>
              {disciplina.data_previsao ? formatDateShort(disciplina.data_previsao) : "sem previsão"}
            </span>
          </span>
        </div>
        {disciplina.data_final && (
          <div className="text-positive-strong font-medium">Entregue em {formatDateShort(disciplina.data_final)}</div>
        )}
        {horasEst > 0 && (
          <div className="text-muted-foreground">
            {horasReal}h de {horasEst}h estimadas
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <DisciplinaStatusBadge status={disciplina.status} />
        {!concluida && atrasada && dlStatus && (
          <Badge variant="destructive" className="text-3xs gap-0.5">
            <AlertTriangle className="h-3 w-3" />
            {dlStatus.days > 0 ? `${dlStatus.days}d de atraso` : "Em atraso"}
          </Badge>
        )}
        {!concluida && atencao && dlStatus && (
          <Badge className="text-3xs gap-0.5 bg-fill-warning hover:bg-fill-warning text-fill-warning-foreground">
            <Clock className="h-3 w-3" />
            {dlStatus.days > 0 ? `vence em ${dlStatus.days}d` : "vence hoje"}
          </Badge>
        )}
      </div>
    </div>
  );
}

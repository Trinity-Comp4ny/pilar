import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertTriangle, Clock, MoreVertical, ExternalLink, Edit, Trash2, ArrowRight } from "lucide-react";
import { PROJECT_STATUS_CONFIG } from "@/constants";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { type Projeto, getDeadlineStatus, getProjectProgress, getResponsaveisList } from "@/types/projetos";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { usePermissions } from "@/hooks/usePermissions";
import { PROJECT_PRIORITY_CONFIG, type ProjectPriority } from "@/constants";
import { AvatarStack } from "@/components/AvatarStack";
import { getPriorityDotColor } from "../lib/priorityColors";

interface ProjectCardProps {
  projeto: Projeto;
  onClick: (projeto: Projeto) => void;
  onEdit?: (projeto: Projeto) => void;
  onDelete?: (id: string) => void;
  onMoveStatus?: (id: string, newStatus: string) => void;
  canEdit?: boolean;
  isDragging?: boolean;
  margemBrutaPct?: number | null;
}

export function ProjectCard({
  projeto,
  onClick,
  onEdit,
  onDelete,
  onMoveStatus,
  canEdit = false,
  isDragging = false,
  margemBrutaPct = null,
}: ProjectCardProps) {
  const formatCurrency = useMoneyMask();
  const { can } = usePermissions();
  const podeVerValor = can("financeiro");
  const navigate = useNavigate();
  const priorityConfig = PROJECT_PRIORITY_CONFIG[projeto.prioridade as ProjectPriority];
  const priorityDot = getPriorityDotColor(projeto.prioridade);
  const progress = getProjectProgress(projeto.disciplinas);
  const deadline = getDeadlineStatus(projeto);
  const showMargemAlert = progress > 80 && margemBrutaPct !== null && margemBrutaPct < 15;

  // Planejamento pendente: disciplinas criadas (ex.: ao converter proposta em
  // projeto) sem datas nem responsáveis. Sem isso o progresso fica preso em 0%
  // e não há como saber que falta planejar. Sinalizamos para o usuário agir.
  const disciplinas = projeto.disciplinas || [];
  const planningPending =
    disciplinas.length > 0 &&
    disciplinas.every((d) => !d.data_inicio && !d.data_previsao && getResponsaveisList(d).length === 0);

  return (
    <Card
      onClick={() => onClick(projeto)}
      className={cn("cursor-pointer w-full p-3 space-y-1.5 bg-white", isDragging && "shadow-md rotate-1")}
    >
      {/* Linha 1: dot prioridade + código + badge alerta + kebab */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", priorityDot)}
            title={`Prioridade ${priorityConfig?.label || "—"}`}
          />
          <span className="text-[10px] font-mono text-muted-foreground tracking-tight truncate">
            {projeto.codigo_projeto}
          </span>
          {showMargemAlert && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-warning-soft text-warning-strong flex-shrink-0">
              <AlertTriangle className="h-2.5 w-2.5" />
              Margem baixa
            </span>
          )}
          {planningPending && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-warning-soft text-warning-strong flex-shrink-0"
              title="Disciplinas sem datas nem responsáveis. Edite o projeto para planejar."
            >
              <Clock className="h-2.5 w-2.5" />
              Planejamento pendente
            </span>
          )}
        </div>
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 -my-2 -mr-2 text-muted-foreground hover:text-foreground"
                aria-label="Mais opções"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => navigate(`/projetos/${projeto.id}`)}>
                <ExternalLink className="h-3.5 w-3.5 mr-2" /> Abrir página completa
              </DropdownMenuItem>
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(projeto)}>
                  <Edit className="h-3.5 w-3.5 mr-2" /> Editar dados
                </DropdownMenuItem>
              )}
              {onMoveStatus && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <ArrowRight className="h-3.5 w-3.5 mr-2" /> Mover para
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {Object.entries(PROJECT_STATUS_CONFIG)
                        .filter(([s]) => s !== projeto.status)
                        .map(([s, cfg]) => (
                          <DropdownMenuItem key={s} onClick={() => onMoveStatus(projeto.id, s)}>
                            {cfg.label}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(projeto.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Linha 2: nome + cliente */}
      <div>
        <p className="text-sm font-medium leading-snug line-clamp-2">{projeto.nome}</p>
        {projeto.cliente_nome && (
          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{projeto.cliente_nome}</p>
        )}
      </div>

      {/* Linha 3: progresso */}
      <div className="flex items-center gap-2">
        <Progress value={progress} className="h-1 flex-1" />
        <span className="text-[10px] text-muted-foreground tabular-nums w-7 text-right">{progress}%</span>
      </div>

      {/* Linha 4: valor + avatares + deadline */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        {/* Sem acesso a financeiro, valor_contrato já vem mascarado (null) de
            projetos_safe — esconder em vez de mostrar "R$ 0,00" enganoso. */}
        {podeVerValor ? (
          <span className="text-xs font-medium text-foreground/80 tabular-nums">
            {formatCurrency(projeto.valor_contrato)}
          </span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {(() => {
            const allNames = (projeto.disciplinas || [])
              .flatMap((d) => getResponsaveisList(d).map((r) => r.responsavel_nome))
              .filter(Boolean);
            return allNames.length > 0 ? <AvatarStack pessoas={allNames} max={3} size="xs" /> : null;
          })()}
          {deadline && (
            <Badge
              className={cn("inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0 font-normal", deadline.color)}
              title={
                deadline.status_data === "em_atraso"
                  ? `Em atraso há ${deadline.days} dia(s)`
                  : deadline.status_data === "atencao"
                    ? `Vence em ${deadline.days} dia(s)`
                    : `No prazo — faltam ${deadline.days} dia(s)`
              }
            >
              {deadline.status_data === "em_atraso" ? (
                <>
                  <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
                  {`-${deadline.days}d`}
                </>
              ) : deadline.status_data === "atencao" ? (
                <>
                  <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
                  {`${deadline.days}d`}
                </>
              ) : (
                `${deadline.days}d`
              )}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}

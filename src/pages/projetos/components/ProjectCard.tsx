import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
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
import { MoreVertical, ExternalLink, Edit, Trash2, ArrowRight } from "lucide-react";
import { PROJECT_STATUS_CONFIG } from "@/constants";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  type Projeto,
  formatCurrency,
  formatDateShort,
  getDeadlineStatus,
  getProjectProgress,
  getResponsaveisList,
} from "@/types/projetos";
import { PROJECT_PRIORITY_CONFIG, type ProjectPriority } from "@/constants";
import { AvatarStack } from "./AvatarStack";

interface ProjectCardProps {
  projeto: Projeto;
  onClick: (projeto: Projeto) => void;
  onEdit?: (projeto: Projeto) => void;
  onDelete?: (id: string) => void;
  onMoveStatus?: (id: string, newStatus: string) => void;
  canEdit?: boolean;
  isDragging?: boolean;
}

export function ProjectCard({
  projeto,
  onClick,
  onEdit,
  onDelete,
  onMoveStatus,
  canEdit = false,
  isDragging = false,
}: ProjectCardProps) {
  const navigate = useNavigate();
  const priorityConfig = PROJECT_PRIORITY_CONFIG[projeto.prioridade as ProjectPriority];
  const priorityDot =
    projeto.prioridade === "Alta"
      ? "bg-status-cancelled"
      : projeto.prioridade === "Media"
        ? "bg-status-planning"
        : "bg-status-progress";
  const progress = getProjectProgress(projeto.disciplinas);
  const deadline = getDeadlineStatus(projeto);

  return (
    <HoverCard openDelay={500} closeDelay={100}>
      <HoverCardTrigger asChild>
        <Card
          onClick={() => onClick(projeto)}
          className={cn(
            "cursor-pointer hover:shadow-sm hover:border-foreground/20 transition-all w-full p-3 space-y-2 bg-white",
            isDragging && "shadow-md rotate-1"
          )}
        >
          {/* Linha 1: dot prioridade + código + kebab */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", priorityDot)}
                title={`Prioridade ${priorityConfig?.label || "—"}`}
              />
              <span className="text-[10px] font-mono text-muted-foreground tracking-tight truncate">
                {projeto.codigo_projeto}
              </span>
            </div>
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground -mr-1"
                    aria-label="Mais opções"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
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
            <span className="text-xs font-medium text-foreground/80 tabular-nums">
              {formatCurrency(projeto.valor_contrato)}
            </span>
            <div className="flex items-center gap-2">
              {(() => {
                const allNames = (projeto.disciplinas || [])
                  .flatMap((d) => getResponsaveisList(d).map((r) => r.responsavel_nome))
                  .filter(Boolean);
                return allNames.length > 0 ? <AvatarStack names={allNames} max={3} size="xs" /> : null;
              })()}
              {deadline && (
                <Badge className={cn("text-[10px] px-1.5 py-0 font-normal", deadline.color)}>
                  {deadline.days > 0 ? `${deadline.days}d` : deadline.label}
                </Badge>
              )}
            </div>
          </div>
        </Card>
      </HoverCardTrigger>
      <HoverCardContent className="w-72" side="right" align="start">
        <div className="space-y-2.5">
          <div>
            <p className="text-xs text-muted-foreground font-mono">{projeto.codigo_projeto}</p>
            <p className="text-sm font-semibold leading-tight">{projeto.nome}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {priorityConfig && (
              <span
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full font-medium",
                  priorityConfig.bgColor,
                  priorityConfig.color
                )}
              >
                {priorityConfig.label}
              </span>
            )}
            {deadline && (
              <Badge className={cn("text-[10px] px-1.5 py-0", deadline.color)}>
                {deadline.label}
                {deadline.days > 0 && ` (${deadline.days}d)`}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Cliente</p>
              <p className="font-medium truncate">{projeto.cliente_nome || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Valor</p>
              <p className="font-medium text-positive">{formatCurrency(projeto.valor_contrato)}</p>
            </div>
            {projeto.area_m2 !== undefined && projeto.area_m2 > 0 && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Área</p>
                <p className="font-medium">{projeto.area_m2} m²</p>
              </div>
            )}
            {projeto.data_previsao && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Previsão</p>
                <p className="font-medium">{formatDateShort(projeto.data_previsao)}</p>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground uppercase">
              <span>Progresso</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>

          {projeto.disciplinas && projeto.disciplinas.length > 0 && (
            <div className="pt-1 border-t">
              <p className="text-[10px] uppercase text-muted-foreground mb-1">
                {projeto.disciplinas.length} disciplina{projeto.disciplinas.length !== 1 ? "s" : ""}
              </p>
              <div className="flex flex-wrap gap-1">
                {projeto.disciplinas.slice(0, 4).map((disc, i) => (
                  <span
                    key={i}
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded",
                      disc.status === "Concluído" ? "bg-positive/10 text-positive" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {disc.disciplina}
                  </span>
                ))}
                {projeto.disciplinas.length > 4 && (
                  <span className="text-[10px] text-muted-foreground">+{projeto.disciplinas.length - 4}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

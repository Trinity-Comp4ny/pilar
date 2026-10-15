import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { KanbanCard, KanbanPriority } from "@/components/kanban/KanbanCard";
import { AlertTriangle, Clock, ExternalLink, Edit, Trash2, ArrowRight } from "lucide-react";
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

  const nomesResponsaveis = disciplinas
    .flatMap((d) => getResponsaveisList(d).map((r) => r.responsavel_nome))
    .filter(Boolean);

  return (
    <KanbanCard
      onClick={() => onClick(projeto)}
      isDragging={isDragging}
      eyebrow={
        <>
          <KanbanPriority
            label={priorityConfig?.label ?? "Sem prioridade"}
            dotClass={priorityDot}
            title={`Prioridade ${priorityConfig?.label || "—"}`}
          />
          {showMargemAlert && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium text-warning-strong">
              <AlertTriangle className="h-2.5 w-2.5" />
              Margem baixa
            </span>
          )}
          {planningPending && (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium text-warning-strong"
              title="Disciplinas sem datas nem responsáveis. Edite o projeto para planejar."
            >
              <Clock className="h-2.5 w-2.5" />
              Planejamento pendente
            </span>
          )}
        </>
      }
      menu={
        canEdit ? (
          <>
            <DropdownMenuItem onClick={() => navigate(`/projetos/${projeto.id}`)}>
              <ExternalLink className="mr-2 h-3.5 w-3.5" /> Abrir página completa
            </DropdownMenuItem>
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(projeto)}>
                <Edit className="mr-2 h-3.5 w-3.5" /> Editar dados
              </DropdownMenuItem>
            )}
            {onMoveStatus && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ArrowRight className="mr-2 h-3.5 w-3.5" /> Mover para
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
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir
                </DropdownMenuItem>
              </>
            )}
          </>
        ) : undefined
      }
      title={projeto.nome}
      subtitle={projeto.cliente_nome}
      meta={
        <div className="flex w-full items-center gap-2">
          <Progress value={progress} className="h-1 flex-1" />
          <span className="w-7 text-right text-[11px] tabular-nums">{progress}%</span>
        </div>
      }
      footer={
        <>
          {/* Sem acesso a financeiro, valor_contrato já vem mascarado (null) de
              projetos_safe — esconder em vez de mostrar "R$ 0,00" enganoso. */}
          {podeVerValor ? (
            <span className="font-medium tabular-nums text-foreground/80">
              {formatCurrency(projeto.valor_contrato)}
            </span>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {nomesResponsaveis.length > 0 && <AvatarStack pessoas={nomesResponsaveis} max={3} size="xs" />}
            {deadline && (
              <Badge
                className={cn("inline-flex items-center gap-0.5 px-1.5 py-0 text-[11px] font-normal", deadline.color)}
                title={
                  deadline.status_data === "em_atraso"
                    ? `Em atraso há ${deadline.days} dia(s)`
                    : deadline.status_data === "atencao"
                      ? `Vence em ${deadline.days} dia(s)`
                      : `No prazo, faltam ${deadline.days} dia(s)`
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
        </>
      }
    />
  );
}

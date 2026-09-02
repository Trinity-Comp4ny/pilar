import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { MoreVertical, ArrowRight, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import type { Lead } from "@/hooks/useLeads";
import { PROPOSTA_STATUS_CONFIG, type Proposta } from "@/hooks/usePropostas";
import { statusExibido } from "@/lib/comercial";
import { AvatarStack } from "@/components/AvatarStack";

const statusLabels: Record<string, string> = {
  Novo: "Novo",
  "Em contato": "Em Contato",
  Proposta: "Proposta Enviada",
  Negociação: "Em Negociação",
  Ganho: "Ganho",
  Perdido: "Perdido",
};

type Props = {
  lead: Lead;
  leadNome: (lead: Lead) => string;
  onClick: () => void;
  canEdit: boolean;
  onEdit: (lead: Lead) => void;
  onDelete: (id: string) => void;
  onMoveStatus?: (leadId: string, status: Lead["status"]) => void;
  dragging?: boolean;
  proposta?: Proposta | null;
  responsavelNome?: string | null;
};

/**
 * Card enxuto no padrão do `ProjectCard` (Trello-like): nome, empresa,
 * badges, valor e responsável na face (spec 061, feedback do Matheus 25/08 —
 * cards densos demais escondiam quantos leads cabiam por coluna).
 */
export function LeadKanbanCard({
  lead,
  leadNome,
  onClick,
  canEdit,
  onEdit,
  onDelete,
  onMoveStatus,
  dragging,
  proposta,
  responsavelNome,
}: Props) {
  const formatCurrency = useMoneyMask();
  const propStatus = proposta ? statusExibido(proposta) : null;
  const propStatusConfig = propStatus ? PROPOSTA_STATUS_CONFIG[propStatus] : null;
  const valor =
    proposta && proposta.valor_proposto != null
      ? proposta.valor_proposto
      : lead.valor_estimado != null
        ? lead.valor_estimado
        : null;
  return (
    <Card
      onClick={onClick}
      className={cn("cursor-pointer w-full p-3 space-y-1.5 bg-white", dragging && "shadow-md rotate-1")}
    >
      {/* Linha 1: nome + kebab */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">{leadNome(lead)}</span>
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 -my-1 -mr-1 text-muted-foreground hover:text-foreground flex-shrink-0"
                aria-label="Mais opções"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onEdit(lead)}>
                <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
              </DropdownMenuItem>
              {onMoveStatus && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ArrowRight className="h-3.5 w-3.5 mr-2" /> Mover para
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {Object.keys(statusLabels)
                      .filter((s) => s !== lead.status)
                      .map((s) => (
                        <DropdownMenuItem key={s} onClick={() => onMoveStatus(lead.id, s as Lead["status"])}>
                          {statusLabels[s]}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(lead.id)}>
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Linha 2: empresa + badges */}
      {(lead.empresa_lead || lead.cliente_id || propStatusConfig) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {lead.empresa_lead && <span className="text-[11px] text-muted-foreground truncate">{lead.empresa_lead}</span>}
          {lead.cliente_id && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-brand text-ink border-brand/40">
              Cliente
            </Badge>
          )}
          {propStatusConfig && (
            <Badge
              variant="outline"
              className={cn("text-[10px] h-5 px-1.5 border-transparent", propStatusConfig.color)}
            >
              {propStatusConfig.label}
            </Badge>
          )}
        </div>
      )}

      {/* Linha 3: valor + responsável */}
      {(valor != null || responsavelNome) && (
        <div className="flex items-center justify-between gap-2 pt-0.5">
          {valor != null ? (
            <span className="text-xs font-medium text-foreground/80 tabular-nums">{formatCurrency(valor)}</span>
          ) : (
            <span />
          )}
          {responsavelNome && <AvatarStack pessoas={[responsavelNome]} max={1} size="xs" />}
        </div>
      )}
    </Card>
  );
}

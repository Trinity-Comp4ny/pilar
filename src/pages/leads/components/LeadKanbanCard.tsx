import { Badge } from "@/components/ui/badge";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { KanbanCard } from "@/components/kanban/KanbanCard";
import { ArrowRight, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { usePermissions } from "@/hooks/usePermissions";
import type { Lead } from "@/hooks/useLeads";
import type { LeadEtapa } from "@/pages/leads/hooks/useLeadEtapas";
import { PROPOSTA_STATUS_CONFIG, type Proposta } from "@/hooks/usePropostas";
import { statusExibido } from "@/pages/leads/lib/comercial";
import { etapaDoLead } from "@/pages/leads/lib/etapas";
import { AvatarStack } from "@/components/AvatarStack";

type Props = {
  lead: Lead;
  leadNome: (lead: Lead) => string;
  onClick: () => void;
  canEdit: boolean;
  onEdit: (lead: Lead) => void;
  onDelete: (id: string) => void;
  /** Colunas do funil, para o menu "Mover para" (mobile). */
  etapas?: LeadEtapa[];
  onMoveEtapa?: (leadId: string, etapa: LeadEtapa) => void;
  dragging?: boolean;
  proposta?: Proposta | null;
  responsavelNome?: string | null;
};

/**
 * Card enxuto sobre o `KanbanCard` padrão (SPEC 122): nome, empresa, badges,
 * valor e responsável na face (spec 061, feedback do Matheus 25/08: cards
 * densos demais escondiam quantos leads cabiam por coluna).
 */
export function LeadKanbanCard({
  lead,
  leadNome,
  onClick,
  canEdit,
  onEdit,
  onDelete,
  etapas = [],
  onMoveEtapa,
  dragging,
  proposta,
  responsavelNome,
}: Props) {
  const formatCurrency = useMoneyMask();
  const { can } = usePermissions();
  const podeVerValor = can("financeiro");
  const etapaAtualId = etapaDoLead(lead, etapas)?.id;
  const propStatus = proposta ? statusExibido(proposta) : null;
  const propStatusConfig = propStatus ? PROPOSTA_STATUS_CONFIG[propStatus] : null;
  const valor = !podeVerValor
    ? null
    : proposta && proposta.valor_proposto != null
      ? proposta.valor_proposto
      : lead.valor_estimado != null
        ? lead.valor_estimado
        : null;
  const temBadges = !!lead.cliente_id || !!propStatusConfig;
  return (
    <KanbanCard
      onClick={onClick}
      isDragging={dragging}
      eyebrow={
        temBadges ? (
          <>
            {lead.cliente_id && (
              <Badge variant="outline" className="h-5 border-brand/40 bg-brand px-1.5 text-[11px] font-normal text-ink">
                Cliente
              </Badge>
            )}
            {propStatusConfig && (
              <Badge
                variant="outline"
                className={cn("h-5 border-transparent px-1.5 text-[11px] font-normal", propStatusConfig.color)}
              >
                {propStatusConfig.label}
              </Badge>
            )}
          </>
        ) : undefined
      }
      menu={
        canEdit ? (
          <>
            <DropdownMenuItem onClick={() => onEdit(lead)}>
              <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
            </DropdownMenuItem>
            {onMoveEtapa && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ArrowRight className="mr-2 h-3.5 w-3.5" /> Mover para
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {etapas
                    .filter((e) => e.id !== etapaAtualId)
                    .map((e) => (
                      <DropdownMenuItem key={e.id} onClick={() => onMoveEtapa(lead.id, e)}>
                        {e.nome}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(lead.id)}>
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir
            </DropdownMenuItem>
          </>
        ) : undefined
      }
      title={leadNome(lead)}
      subtitle={lead.empresa_lead}
      footer={
        valor != null || responsavelNome ? (
          <>
            {valor != null ? (
              <span className="font-medium tabular-nums text-foreground/80">{formatCurrency(valor)}</span>
            ) : (
              <span />
            )}
            {responsavelNome && <AvatarStack pessoas={[responsavelNome]} max={1} size="xs" />}
          </>
        ) : undefined
      }
    />
  );
}

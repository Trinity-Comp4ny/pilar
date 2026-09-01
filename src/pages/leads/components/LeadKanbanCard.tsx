import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Mail, Phone, MoreVertical, ArrowRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currencyUtils";
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
  onMoveStatus: (leadId: string, status: Lead["status"]) => void;
  dragging?: boolean;
  proposta?: Proposta | null;
  responsavelNome?: string | null;
};

/**
 * Card enxuto no padrão do `ProjectCard` (Trello-like): nome, empresa,
 * badges, valor e responsável na face; email/telefone/origem/motivo de perda
 * só no HoverCard (spec 061, feedback do Matheus 25/08 — cards densos demais
 * escondiam quantos leads cabiam por coluna).
 */
export function LeadKanbanCard({
  lead,
  leadNome,
  onClick,
  canEdit,
  onMoveStatus,
  dragging,
  proposta,
  responsavelNome,
}: Props) {
  const propStatus = proposta ? statusExibido(proposta) : null;
  const propStatusConfig = propStatus ? PROPOSTA_STATUS_CONFIG[propStatus] : null;
  const valor =
    proposta && proposta.valor_proposto != null
      ? proposta.valor_proposto
      : lead.valor_estimado != null
        ? lead.valor_estimado
        : null;
  const valorDeProposta = proposta && proposta.valor_proposto != null;

  return (
    <HoverCard openDelay={500} closeDelay={100}>
      <HoverCardTrigger asChild>
        <Card
          onClick={onClick}
          className={cn(
            "cursor-pointer hover:shadow-sm hover:border-foreground/20 transition-all w-full p-3 space-y-1.5 bg-white",
            dragging && "shadow-md rotate-1"
          )}
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
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Linha 2: empresa + badges */}
          {(lead.empresa_lead || lead.cliente_id || propStatusConfig) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {lead.empresa_lead && (
                <span className="text-[11px] text-muted-foreground truncate">{lead.empresa_lead}</span>
              )}
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
      </HoverCardTrigger>
      <HoverCardContent className="w-72" side="right" align="start">
        <div className="space-y-2.5">
          <div>
            <p className="text-sm font-semibold leading-tight">{leadNome(lead)}</p>
            {lead.empresa_lead && <p className="text-xs text-muted-foreground mt-0.5">{lead.empresa_lead}</p>}
          </div>

          {(lead.cliente_id || propStatusConfig) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {lead.cliente_id && (
                <Badge variant="outline" className="text-xs h-5 px-1.5 bg-brand text-ink border-brand/40">
                  Cliente
                </Badge>
              )}
              {propStatusConfig && (
                <Badge
                  variant="outline"
                  className={cn("text-xs h-5 px-1.5 border-transparent", propStatusConfig.color)}
                >
                  {propStatusConfig.label}
                </Badge>
              )}
            </div>
          )}

          {lead.email && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail size={13} className="flex-shrink-0" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
          {lead.contato && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone size={13} className="flex-shrink-0" />
              <span className="truncate">{lead.contato}</span>
            </div>
          )}
          {lead.origem && <p className="text-xs text-muted-foreground pt-2 border-t">Origem: {lead.origem}</p>}
          {lead.status === "Perdido" && lead.motivo_perda && (
            <p className="text-xs text-chart-danger/80 pt-2 border-t border-danger-soft-border">
              Motivo: {lead.motivo_perda}
            </p>
          )}

          {valor != null && (
            <div className="pt-2 border-t">
              <p className="text-[10px] uppercase text-muted-foreground">
                {valorDeProposta ? "Valor da proposta" : "Valor estimado"}
              </p>
              <p className="flex items-center gap-1 text-sm font-semibold text-foreground">
                {valorDeProposta && <FileText size={12} className="text-muted-foreground" />}
                {formatCurrency(valor)}
                {valorDeProposta && proposta?.margem_estimada_pct != null && (
                  <span className="text-xs font-normal text-muted-foreground">
                    · margem {Math.round(proposta.margem_estimada_pct)}%
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

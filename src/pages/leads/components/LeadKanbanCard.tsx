import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Mail, Phone, User, MoreVertical, ArrowRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currencyUtils";
import type { Lead } from "@/hooks/useLeads";
import { PROPOSTA_STATUS_CONFIG, type Proposta } from "@/hooks/usePropostas";
import { statusExibido } from "@/lib/comercial";
import { AvatarStack } from "@/pages/projetos/components/AvatarStack";

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
    <Card
      onClick={onClick}
      className={cn("cursor-pointer hover:shadow-md transition-shadow w-full", dragging && "shadow-lg opacity-90")}
    >
      <CardHeader className="p-3 pb-2">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-medium flex items-start gap-2">
              <User size={16} className="mt-0.5 flex-shrink-0" />
              <span className="line-clamp-1">{leadNome(lead)}</span>
            </CardTitle>
            {lead.empresa_lead && (
              <p className="text-xs text-muted-foreground mt-0.5 ml-6 line-clamp-1">{lead.empresa_lead}</p>
            )}
          </div>
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 -my-1 -mr-1 text-muted-foreground hover:text-foreground"
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

        {(lead.cliente_id || propStatusConfig) && (
          <div className="flex flex-wrap items-center gap-1 mt-2">
            {lead.cliente_id && (
              <Badge variant="outline" className="text-xs h-5 px-1.5 bg-brand text-ink border-brand/40">
                Cliente
              </Badge>
            )}
            {propStatusConfig && (
              <Badge variant="outline" className={cn("text-xs h-5 px-1.5 border-transparent", propStatusConfig.color)}>
                {propStatusConfig.label}
              </Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-1.5">
        {lead.email && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail size={14} className="flex-shrink-0" />
            <span className="line-clamp-1">{lead.email}</span>
          </div>
        )}
        {lead.contato && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone size={14} className="flex-shrink-0" />
            <span className="line-clamp-1">{lead.contato}</span>
          </div>
        )}
        {lead.origem && (
          <p className="text-sm text-muted-foreground line-clamp-1 mt-2 pt-2 border-t">Origem: {lead.origem}</p>
        )}
        {lead.status === "Perdido" && lead.motivo_perda && (
          <p className="text-sm text-chart-danger/80 line-clamp-2 mt-1 pt-1 border-t border-danger-soft-border">
            Motivo: {lead.motivo_perda}
          </p>
        )}

        {(valor != null || responsavelNome) && (
          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t">
            {valor != null ? (
              <span
                className="flex items-center gap-1 text-xs font-semibold text-foreground tabular-nums"
                title={valorDeProposta ? "Valor da proposta" : "Valor estimado do lead"}
              >
                {valorDeProposta && <FileText size={11} className="text-muted-foreground" />}
                {formatCurrency(valor)}
                {valorDeProposta && proposta?.margem_estimada_pct != null && (
                  <span className="text-[10px] font-normal text-muted-foreground">
                    · margem {Math.round(proposta.margem_estimada_pct)}%
                  </span>
                )}
              </span>
            ) : (
              <span />
            )}
            {responsavelNome && <AvatarStack names={[responsavelNome]} max={1} size="xs" />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

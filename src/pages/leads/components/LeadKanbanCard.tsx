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
import { Mail, Phone, User, MoreVertical, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currencyUtils";
import type { Lead } from "@/hooks/useLeads";

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
  onMoveStatus: (leadId: string, status: string) => void;
  dragging?: boolean;
};

export function LeadKanbanCard({ lead, leadNome, onClick, canEdit, onMoveStatus, dragging }: Props) {
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
          <div className="flex flex-col items-end gap-1 shrink-0">
            {lead.cliente_id && (
              <Badge variant="outline" className="text-xs h-5 px-1.5 bg-brand text-ink border-brand/40">
                Cliente
              </Badge>
            )}
            {lead.valor_estimado != null && (
              <span className="text-xs font-semibold text-brand tabular-nums">
                {formatCurrency(lead.valor_estimado)}
              </span>
            )}
          </div>
        </div>
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
        {canEdit && (
          <div className="flex justify-end pt-2 mt-1 border-t" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground">
                  <MoreVertical className="h-3.5 w-3.5" />
                  Ações
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ArrowRight className="h-3.5 w-3.5 mr-2" /> Mover para
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {Object.keys(statusLabels)
                      .filter((s) => s !== lead.status)
                      .map((s) => (
                        <DropdownMenuItem key={s} onClick={() => onMoveStatus(lead.id, s)}>
                          {statusLabels[s]}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

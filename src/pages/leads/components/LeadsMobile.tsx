import { ChevronDown } from "lucide-react";
import type { Lead } from "@/hooks/useLeads";
import type { Proposta } from "@/hooks/usePropostas";
import type { LeadEtapa } from "@/pages/leads/hooks/useLeadEtapas";
import { corDaEtapaLead } from "@/pages/leads/lib/etapas";
import { LeadKanbanCard } from "./LeadKanbanCard";

type Props = {
  etapas: LeadEtapa[];
  leadsDaEtapa: (etapaId: string) => Lead[];
  leadNome: (lead: Lead) => string;
  canEdit: boolean;
  proposta: (leadId: string) => Proposta | null;
  responsavelNome: (id?: string | null) => string | null;
  onAbrir: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
  onDelete: (id: string) => void;
  onMover: (leadId: string, etapa: LeadEtapa) => void;
};

/** Visão mobile: um acordeão por coluna do funil, com "Mover para" no menu do card. */
export function LeadsMobile({
  etapas,
  leadsDaEtapa,
  leadNome,
  canEdit,
  proposta,
  responsavelNome,
  onAbrir,
  onEdit,
  onDelete,
  onMover,
}: Props) {
  return (
    <div className="md:hidden space-y-3">
      {etapas.map((etapa) => {
        const items = leadsDaEtapa(etapa.id);
        if (items.length === 0) return null;
        return (
          <details key={etapa.id} open className="border rounded-lg bg-white">
            <summary className="flex items-center gap-2 px-3 py-2.5 cursor-pointer list-none">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: corDaEtapaLead(etapa.cor, etapa.bucket) }}
              />
              <span className="text-xs font-medium uppercase tracking-wide flex-1">{etapa.nome}</span>
              <span className="text-[11px] text-muted-foreground tabular-nums">{items.length}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </summary>
            <div className="p-2 space-y-2 border-t bg-muted/20">
              {items.map((lead) => (
                <LeadKanbanCard
                  key={lead.id}
                  lead={lead}
                  leadNome={leadNome}
                  onClick={() => onAbrir(lead)}
                  canEdit={canEdit}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  etapas={etapas}
                  onMoveEtapa={onMover}
                  proposta={proposta(lead.id)}
                  responsavelNome={responsavelNome(lead.responsavel_id)}
                />
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

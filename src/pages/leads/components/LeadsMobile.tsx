import type { Lead } from "@/hooks/useLeads";
import type { Proposta } from "@/hooks/usePropostas";
import type { LeadEtapa } from "@/pages/leads/hooks/useLeadEtapas";
import { corDaEtapaLead } from "@/pages/leads/lib/etapas";
import { KanbanMobile } from "@/components/kanban/KanbanMobile";
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

/** Funil no celular: colunas lado a lado, passando com o dedo, com "Mover para" no menu do card. */
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
  const colunas = etapas.map((etapa) => {
    const items = leadsDaEtapa(etapa.id);
    return {
      id: etapa.id,
      titulo: etapa.nome,
      cor: corDaEtapaLead(etapa.cor, etapa.bucket),
      quantidade: items.length,
      children: items.map((lead) => (
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
      )),
    };
  });

  return <KanbanMobile colunas={colunas} ariaLabel="Funil de leads" />;
}

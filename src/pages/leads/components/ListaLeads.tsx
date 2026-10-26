import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { formatDate } from "@/lib/dateUtils";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { usePermissions } from "@/hooks/usePermissions";
import type { Lead } from "@/hooks/useLeads";
import type { Proposta } from "@/hooks/usePropostas";

interface ListaLeadsProps {
  leads: Lead[];
  leadNome: (lead: Lead) => string;
  responsavelNome: (id?: string | null) => string | null;
  primariaDoLead: (leadId: string) => Proposta | null;
  /** Nome e cor da coluna do lead (SPEC 120: o funil é editável). */
  etapaDe: (lead: Lead) => { nome: string; cor: string } | null;
  onRowClick: (lead: Lead) => void;
}

// Visão Lista (desktop): tabela dos leads filtrados/ordenados. Espelha o padrão
// de tabela de Projetos (ListaProjetos) — mesmo par Quadro/Lista, mesma estrutura.
export function ListaLeads({ leads, leadNome, responsavelNome, primariaDoLead, etapaDe, onRowClick }: ListaLeadsProps) {
  const formatCurrency = useMoneyMask();
  const { can } = usePermissions();
  const podeVerValor = can("financeiro");
  const columns: ColumnDef<Lead>[] = [
    { key: "nome", header: "Nome", className: "font-medium", cell: (lead) => leadNome(lead) },
    {
      key: "empresa",
      header: "Empresa",
      className: "text-muted-foreground",
      cell: (lead) => lead.empresa_lead ?? "—",
    },
    {
      key: "etapa",
      header: "Etapa",
      cell: (lead) => {
        const etapa = etapaDe(lead);
        return (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full bg-muted-foreground/40"
              style={etapa ? { backgroundColor: etapa.cor } : undefined}
            />
            <span className="text-sm">{etapa?.nome ?? lead.status}</span>
          </span>
        );
      },
    },
    ...(podeVerValor
      ? [
          {
            key: "valor",
            header: "Valor estimado",
            align: "end" as const,
            className: "tabular-nums",
            cell: (lead: Lead) => {
              const valor = primariaDoLead(lead.id)?.valor_proposto ?? lead.valor_estimado ?? 0;
              return valor ? formatCurrency(valor) : "—";
            },
          },
        ]
      : []),
    {
      key: "responsavel",
      header: "Responsável",
      className: "text-muted-foreground",
      cell: (lead) => responsavelNome(lead.responsavel_id) ?? "—",
    },
    {
      key: "previsao",
      header: "Previsão",
      className: "text-muted-foreground",
      cell: (lead) => (lead.previsao_fechamento ? formatDate(lead.previsao_fechamento) : "—"),
    },
    { key: "origem", header: "Origem", className: "text-muted-foreground", cell: (lead) => lead.origem ?? "—" },
  ];

  return (
    <div className="hidden md:block overflow-x-auto rounded-lg border">
      <DataTable
        columns={columns}
        data={{ rows: leads, isPending: false, error: null }}
        rowKey={(lead) => lead.id}
        onRowClick={onRowClick}
        emptyMessage="Nenhum lead nesta lista."
      />
    </div>
  );
}

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/dateUtils";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import type { Lead } from "@/hooks/useLeads";
import type { Proposta } from "@/hooks/usePropostas";

interface ListaLeadsProps {
  leads: Lead[];
  leadNome: (lead: Lead) => string;
  responsavelNome: (id?: string | null) => string | null;
  primariaDoLead: (leadId: string) => Proposta | null;
  statusDot: Record<string, string>;
  statusLabelOf: (status: string) => string;
  onRowClick: (lead: Lead) => void;
}

// Visão Lista (desktop): tabela dos leads filtrados/ordenados. Espelha o padrão
// de tabela de Projetos (ListaProjetos) — mesmo par Quadro/Lista, mesma estrutura.
export function ListaLeads({
  leads,
  leadNome,
  responsavelNome,
  primariaDoLead,
  statusDot,
  statusLabelOf,
  onRowClick,
}: ListaLeadsProps) {
  const formatCurrency = useMoneyMask();
  return (
    <div className="hidden md:block overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead className="text-right">Valor estimado</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Previsão</TableHead>
            <TableHead>Origem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => {
            const proposta = primariaDoLead(lead.id);
            const valor = proposta?.valor_proposto ?? lead.valor_estimado ?? 0;
            const responsavel = responsavelNome(lead.responsavel_id);
            return (
              <TableRow key={lead.id} className="cursor-pointer" onClick={() => onRowClick(lead)}>
                <TableCell className="font-medium">{leadNome(lead)}</TableCell>
                <TableCell className="text-muted-foreground">{lead.empresa_lead ?? "—"}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full", statusDot[lead.status] ?? "bg-pipeline-perdido")} />
                    <span className="text-sm">{statusLabelOf(lead.status)}</span>
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{valor ? formatCurrency(valor) : "—"}</TableCell>
                <TableCell className="text-muted-foreground">{responsavel ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {lead.previsao_fechamento ? formatDate(lead.previsao_fechamento) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{lead.origem ?? "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

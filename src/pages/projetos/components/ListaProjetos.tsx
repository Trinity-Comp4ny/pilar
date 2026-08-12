import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { formatDate } from "@/lib/dateUtils";
import { PROJECT_PRIORITY_CONFIG, type ProjectPriority } from "@/constants";
import { type Projeto, getDeadlineStatus } from "@/types/projetos";
import { type ProjetoEtapa } from "@/pages/projetos/hooks/useProjetoEtapas";

interface ListaProjetosProps {
  projetos: Projeto[];
  etapas: ProjetoEtapa[];
  rentabilidadeMap: Record<string, number>;
  onCardClick: (projeto: Projeto) => void;
}

// Visão Lista (desktop): tabela dos projetos filtrados/ordenados. Espelha o
// padrão de tabela de "Meu trabalho". A coluna "Coluna" mostra a etapa (nome+cor).
export function ListaProjetos({ projetos, etapas, rentabilidadeMap, onCardClick }: ListaProjetosProps) {
  const etapaById = useMemo(() => new Map(etapas.map((e) => [e.id, e])), [etapas]);

  return (
    <div className="hidden md:block overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Código</TableHead>
            <TableHead>Projeto</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Coluna</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead>Prazo</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Margem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projetos.map((p) => {
            const etapa = p.etapa_id ? etapaById.get(p.etapa_id) : undefined;
            const prio = PROJECT_PRIORITY_CONFIG[p.prioridade as ProjectPriority];
            const prazo = getDeadlineStatus(p);
            const margem = rentabilidadeMap[p.id];
            return (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => onCardClick(p)}>
                <TableCell className="font-mono text-xs text-muted-foreground">{p.codigo_projeto}</TableCell>
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell className="text-muted-foreground">{p.cliente_nome ?? "—"}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: etapa?.cor ?? "#94a3b8" }} />
                    <span className="text-sm">{etapa?.nome ?? p.status}</span>
                  </span>
                </TableCell>
                <TableCell>
                  {prio && (
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span className={cn("h-2 w-2 rounded-full", prio.dotColor)} />
                      {prio.label}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {prazo ? (
                    <Badge className={cn("text-[11px]", prazo.color)}>{prazo.label}</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {p.data_previsao ? formatDate(p.data_previsao) : "—"}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(p.valor_contrato || 0, { decimals: 0 })}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {typeof margem === "number" ? `${margem.toFixed(0)}%` : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

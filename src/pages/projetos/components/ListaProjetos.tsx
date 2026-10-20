import { useMemo } from "react";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/dateUtils";
import { useMoneyMask } from "@/hooks/useMoneyMask";
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
// Abaixo de md o DataTable vira lista de cards (nome, cliente, prazo e valor).
export function ListaProjetos({ projetos, etapas, rentabilidadeMap, onCardClick }: ListaProjetosProps) {
  const formatCurrency = useMoneyMask();
  const etapaById = useMemo(() => new Map(etapas.map((e) => [e.id, e])), [etapas]);

  const columns: ColumnDef<Projeto>[] = [
    { key: "nome", header: "Projeto", className: "font-medium", mobile: "title", cell: (p) => p.nome },
    {
      key: "cliente",
      header: "Cliente",
      className: "text-muted-foreground",
      mobile: "subtitle",
      cell: (p) => p.cliente_nome ?? "—",
    },
    {
      key: "coluna",
      header: "Coluna",
      cell: (p) => {
        const etapa = p.etapa_id ? etapaById.get(p.etapa_id) : undefined;
        return (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: etapa?.cor ?? "#94a3b8" }} />
            <span className="text-sm">{etapa?.nome ?? p.status}</span>
          </span>
        );
      },
    },
    {
      key: "prioridade",
      header: "Prioridade",
      cell: (p) => {
        const prio = PROJECT_PRIORITY_CONFIG[p.prioridade as ProjectPriority];
        return prio ? (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <span className={cn("h-2 w-2 rounded-full", prio.dotColor)} />
            {prio.label}
          </span>
        ) : null;
      },
    },
    {
      key: "prazo",
      header: "Prazo",
      mobile: "badge",
      cell: (p) => {
        const prazo = getDeadlineStatus(p);
        return prazo ? (
          <Badge className={cn("text-[11px]", prazo.color)}>{prazo.label}</Badge>
        ) : (
          <span className="text-sm text-muted-foreground">{p.data_previsao ? formatDate(p.data_previsao) : "—"}</span>
        );
      },
    },
    {
      key: "valor",
      header: "Valor",
      align: "end",
      className: "tabular-nums",
      mobile: "trailing",
      cell: (p) => formatCurrency(p.valor_contrato || 0, { decimals: 0 }),
    },
    {
      key: "margem",
      header: "Margem",
      align: "end",
      className: "tabular-nums",
      cell: (p) => {
        const margem = rentabilidadeMap[p.id];
        return typeof margem === "number" ? `${margem.toFixed(0)}%` : "—";
      },
    },
  ];

  return (
    <div className="md:overflow-x-auto md:rounded-lg md:border">
      <DataTable
        columns={columns}
        data={{ rows: projetos, isPending: false, error: null }}
        rowKey={(p) => p.id}
        onRowClick={onCardClick}
        emptyMessage="Nenhum projeto nesta lista."
      />
    </div>
  );
}

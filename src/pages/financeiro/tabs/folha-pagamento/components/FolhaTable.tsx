import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileDown, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { useAcaoPendente } from "@/hooks/useAcaoPendente";
import { formatPercent } from "@/lib/format";
import type { FolhaItem } from "../types";

interface FolhaTableProps {
  data: FolhaItem[];
  loading: boolean;
  statusFolha: "preview" | "closed";
  // Delta do total a receber vs o mês anterior, por pessoa (undefined = sem folha
  // anterior para comparar). Só usado no preview.
  deltas?: Map<string, number>;
  onRowClick: (item: FolhaItem) => void;
  onStatusChange: (folhaId: string | undefined, newStatus: string) => void;
  onDownloadComprovante?: (item: FolhaItem) => void | Promise<void>;
}

export function FolhaTable({
  data,
  loading,
  statusFolha,
  deltas,
  onRowClick,
  onStatusChange,
  onDownloadComprovante,
}: FolhaTableProps) {
  const formatCurrency = useMoneyMask();
  // Gerar o PDF leva alguns segundos: o botão mostra a espera e não aceita o segundo clique.
  const { executar, pendente } = useAcaoPendente();
  const isEdited = (item: FolhaItem, field: string) => item.edited_fields?.includes(field);
  const isPreview = statusFolha === "preview";

  // Colunas no DataTable padrão (SPEC 127). Preview e folha fechada mostram colunas diferentes no fim.
  const columns: ColumnDef<FolhaItem>[] = [
    {
      key: "colaborador",
      header: "Colaborador",
      cell: (item) => {
        const semProjeto = (item.detalhe_projetos?.length ?? 0) === 0;
        const variavelZerado = item.v_variavel === 0;
        return (
          <>
            <div className="flex items-center gap-2">
              <span className="font-medium">{item.p_nome}</span>
              {isPreview && (semProjeto || variavelZerado) && (
                <span
                  title={semProjeto ? "Sem projeto no período" : "Variável zerado"}
                  className="inline-flex items-center gap-1 text-[10px] text-warning-strong bg-warning-soft rounded px-1.5 py-0.5"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {semProjeto ? "sem projeto" : "variável 0"}
                </span>
              )}
            </div>
            {item.detalhe_projetos && item.detalhe_projetos.length > 0 && (
              <div
                className="text-xs text-muted-foreground truncate max-w-[220px]"
                title={item.detalhe_projetos.map((p) => p.nome).join(", ")}
              >
                {item.detalhe_projetos.length} projeto(s): {item.detalhe_projetos[0].nome}
                {item.detalhe_projetos.length > 1 && ` +${item.detalhe_projetos.length - 1}`}
              </div>
            )}
          </>
        );
      },
    },
    { key: "cargo", header: "Cargo", cell: (item) => item.p_cargo },
    {
      key: "salario",
      header: "Salário fixo",
      align: "end",
      cell: (item) => (
        <>
          {formatCurrency(item.p_salario_fixo)} {isEdited(item, "salario") && "*"}
        </>
      ),
    },
    {
      key: "produtividade",
      header: "Produtividade",
      align: "center",
      cell: (item) => {
        // Uma linha por regra de produtividade da pessoa: m², percentual ou as duas.
        const temPercentual = (item.p_percentual ?? 0) > 0;
        const temM2 = item.p_valor_m2 > 0 || !temPercentual;
        return (
          <div className="flex flex-col items-center gap-0.5">
            {temM2 && (
              <>
                <span className="font-medium">
                  {(item.soma_area ?? 0).toLocaleString("pt-BR")} m² {isEdited(item, "area") && "*"}
                </span>
                <span className="text-xs text-muted-foreground">x {formatCurrency(item.p_valor_m2)}/m²</span>
              </>
            )}
            {temPercentual && (
              <>
                <span className="font-medium">
                  {formatCurrency(item.soma_valor_base ?? 0)} {isEdited(item, "base") && "*"}
                </span>
                <span className="text-xs text-muted-foreground">x {formatPercent(item.p_percentual ?? 0)}</span>
              </>
            )}
          </div>
        );
      },
    },
    {
      key: "variavel",
      header: "Variável",
      align: "end",
      cell: (item) => (
        <span className={`font-medium ${isEdited(item, "variavel") ? "text-foreground" : "text-positive-strong"}`}>
          {isEdited(item, "variavel") ? "" : "+"} {formatCurrency(item.v_variavel)} {isEdited(item, "variavel") && "*"}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total a receber",
      align: "end",
      className: "font-semibold",
      cell: (item) => (
        <>
          {formatCurrency(item.v_total)} {isEdited(item, "total") && "*"}
        </>
      ),
    },
    ...(isPreview
      ? [
          {
            key: "delta",
            header: "vs. mês anterior",
            align: "end" as const,
            cell: (item: FolhaItem) => {
              const delta = deltas?.get(item.p_id);
              if (delta === undefined) return <span className="text-xs text-muted-foreground">-</span>;
              if (delta === 0) return <span className="text-xs text-muted-foreground">sem variação</span>;
              return (
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium ${
                    delta > 0 ? "text-positive-strong" : "text-destructive"
                  }`}
                >
                  {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {delta > 0 ? "+" : ""}
                  {formatCurrency(delta)}
                </span>
              );
            },
          },
        ]
      : [
          {
            key: "status",
            header: "Status",
            align: "center" as const,
            cell: (item: FolhaItem) => (
              <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-auto p-0 px-2 font-normal">
                      <Badge
                        variant="secondary"
                        className={`capitalize cursor-pointer hover:bg-opacity-80 transition-colors px-2 py-0.5 text-xs
                          ${item.status === "pago" ? "bg-positive text-ink" : ""}
                          ${item.status === "pendente" ? "bg-warning-soft text-warning-strong" : ""}
                          ${item.status === "cancelado" ? "bg-destructive text-destructive-foreground" : ""}
                        `}
                      >
                        {item.status}
                      </Badge>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onStatusChange(item.folha_id, "pendente")}>
                      Marcar como pendente
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onStatusChange(item.folha_id, "pago")}>
                      Marcar como pago
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onStatusChange(item.folha_id, "cancelado")}
                      className="text-destructive"
                    >
                      Cancelar pagamento
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ),
          },
          {
            key: "comprovante",
            header: <span className="sr-only">Comprovante</span>,
            align: "center" as const,
            className: "w-[48px]",
            cell: (item: FolhaItem) => (
              <Button
                variant="ghost"
                size="icon-sm"
                title={`Baixar comprovante de ${item.p_nome}`}
                aria-label={`Baixar comprovante de ${item.p_nome}`}
                loading={pendente(item.p_id)}
                onClick={() => executar(item.p_id, async () => onDownloadComprovante?.(item))}
              >
                {!pendente(item.p_id) && <FileDown className="h-4 w-4" />}
              </Button>
            ),
          },
        ]),
  ];

  return (
    <Card className="border-border shadow-sm">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <DataTable
            columns={columns}
            data={{ rows: data, isPending: loading, error: null }}
            rowKey={(item) => item.p_id || item.p_nome}
            onRowClick={isPreview ? onRowClick : undefined}
            rowLabel={isPreview ? (item) => `Ver detalhes de ${item.p_nome}` : undefined}
            emptyMessage="Nenhum registro encontrado para este período."
          />
        </div>
      </CardContent>
    </Card>
  );
}

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { toDataSourceResult } from "@/types/dataSource";
import { formatDate, formatDateShort } from "@/lib/format";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { useFaturas, useInvalidateFaturas, gerarFaturasCartao, type Fatura } from "../hooks/useFaturas";
import { MESES, getStatusBadge } from "./faturaHelpers";

interface FaturasCartaoTableProps {
  cartaoId: string;
  onDetalhe: (fatura: Fatura) => void;
  onPagar: (fatura: Fatura) => void;
}

export function FaturasCartaoTable({ cartaoId, onDetalhe, onPagar }: FaturasCartaoTableProps) {
  const formatCurrency = useMoneyMask();
  const { data: faturas = [], isLoading, error } = useFaturas(cartaoId);
  const invalidateFaturas = useInvalidateFaturas();

  // Garante faturas dos últimos meses (idempotente no backend; 23505 = já existe).
  useEffect(() => {
    if (!cartaoId) return;
    void gerarFaturasCartao(cartaoId)
      .then(() => invalidateFaturas())
      .catch((err) => {
        const msg =
          err instanceof Error ? err.message : ((err as { message?: string })?.message ?? "Erro ao gerar faturas");
        toast.error("Erro ao carregar faturas", { description: msg });
      });
  }, [cartaoId, invalidateFaturas]);

  const columns: ColumnDef<Fatura>[] = [
    {
      key: "referencia",
      header: "Referência",
      stickyLeft: true,
      getSortValue: (f) => f.ano_referencia * 100 + f.mes_referencia,
      cell: (f) => (
        <span className="font-medium">
          {MESES[f.mes_referencia - 1]} {f.ano_referencia}
        </span>
      ),
    },
    {
      key: "ciclo",
      header: "Ciclo",
      cell: (f) => (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {formatDateShort(f.data_inicio)} a {formatDateShort(f.data_fim)}
        </span>
      ),
    },
    {
      key: "vencimento",
      header: "Vencimento",
      getSortValue: (f) => f.data_vencimento,
      cell: (f) => formatDate(f.data_vencimento),
    },
    {
      key: "despesas",
      header: "Despesas",
      align: "center",
      getSortValue: (f) => f.qtd_despesas,
      cell: (f) => f.qtd_despesas,
    },
    {
      key: "valor",
      header: "Valor total",
      align: "end",
      getSortValue: (f) => f.valor_total,
      cell: (f) => {
        const restante = f.valor_total - f.valor_pago;
        return (
          <div className="text-right">
            <p className="font-semibold">{formatCurrency(f.valor_total)}</p>
            {f.valor_pago > 0 && f.status !== "Paga" && (
              <p className="text-xs text-muted-foreground">Restante: {formatCurrency(restante)}</p>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      cell: (f) => getStatusBadge(f.status, f.data_vencimento),
    },
    {
      key: "acao",
      header: "",
      align: "end",
      cell: (f) => {
        const isPagavel = f.status !== "Paga" && f.status !== "Aberta" && f.valor_total > 0;
        return (
          <div className="flex items-center justify-end gap-2">
            {isPagavel && (
              <Button
                size="sm"
                variant="brand"
                className="rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onPagar(f);
                }}
              >
                <DollarSign className="mr-1 h-4 w-4" />
                Pagar
              </Button>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={toDataSourceResult<Fatura>({ data: faturas, isLoading, error })}
      rowKey={(f) => f.id}
      onRowClick={onDetalhe}
      defaultSortKey="referencia"
      defaultSortDir="desc"
      emptyMessage="Nenhuma fatura encontrada para este cartão."
      errorTitle="Não foi possível carregar as faturas"
      minWidth="720px"
    />
  );
}

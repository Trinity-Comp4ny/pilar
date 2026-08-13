import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef as TanstackColumnDef,
  type RowSelectionState,
  type SortingFn,
  type SortingState,
} from "@tanstack/react-table";
import { AlertCircle, ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DataSourceResult } from "@/types/dataSource";

export interface ColumnDef<T> {
  /** Chave única da coluna (usada para ordenação e React key). */
  key: string;
  /** Cabeçalho da coluna. */
  header: ReactNode;
  /** Alinhamento do conteúdo. */
  align?: "start" | "end" | "center";
  /** Fixa a coluna à esquerda ao rolar horizontalmente. */
  stickyLeft?: boolean;
  /** Classe extra aplicada à célula (th e td). */
  className?: string;
  /**
   * Valor usado para ordenar. A presença desta função habilita o clique
   * de ordenação no cabeçalho.
   */
  getSortValue?: (row: T) => number | string;
  /** Renderiza a célula da linha. */
  cell: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  /**
   * Fonte de dados com os três estados obrigatórios (rows, isPending, error).
   * O erro é RENDERIZADO, nunca engolido: se a query falhar, a tabela mostra
   * o estado de erro em vez de uma lista vazia enganosa.
   */
  data: DataSourceResult<T>;
  /** Extrai a chave estável de cada linha. */
  rowKey: (row: T) => string;
  /** Clique na linha (torna a linha interativa). */
  onRowClick?: (row: T) => void;
  /** Coluna de ordenação inicial. */
  defaultSortKey?: string;
  defaultSortDir?: "asc" | "desc";
  /** Mensagem quando não há dados. */
  emptyMessage?: string;
  /**
   * Estado de vazio customizado (opt-in). Quando fornecido, substitui a
   * `emptyMessage` padrão — permite `EmptyState` com ícone e ação.
   */
  emptyState?: ReactNode;
  /** Título do estado de erro. */
  errorTitle?: string;
  /**
   * Estado de erro customizado (opt-in). Quando fornecido, substitui o estado
   * de erro padrão (ícone + mensagem) — permite botão "Tentar de novo".
   */
  errorState?: ReactNode;
  /** Nº de linhas do skeleton de carregamento. */
  loadingRows?: number;
  /** Largura mínima da tabela (rolagem horizontal abaixo disso). */
  minWidth?: string;
  /** Altura máxima com rolagem vertical. */
  maxHeight?: string;
  /**
   * Habilita a coluna de seleção por checkbox (opt-in). O checkbox mestre no
   * cabeçalho seleciona/limpa todas as linhas visíveis.
   */
  enableRowSelection?: boolean;
  /** Notificado com as linhas selecionadas sempre que a seleção muda. */
  onSelectionChange?: (rows: T[]) => void;
  /**
   * Visibilidade de coluna controlada pelo pai (opt-in), por `key`. `false`
   * esconde a coluna. Sem esta prop, todas as colunas ficam visíveis.
   */
  columnVisibility?: Record<string, boolean>;
}

const alignClass: Record<NonNullable<ColumnDef<unknown>["align"]>, string> = {
  start: "text-left",
  end: "text-right",
  center: "text-center",
};

/**
 * Comparador que preserva o comportamento anterior: strings por `localeCompare`
 * (respeita acentos pt-BR), números por subtração. Valores ausentes/não-finitos
 * são mapeados para `undefined` no accessor e posicionados pelo `sortUndefined`
 * da coluna, independentemente da direção.
 */
const mixedSortingFn: SortingFn<unknown> = (rowA, rowB, columnId) => {
  const a = rowA.getValue(columnId);
  const b = rowB.getValue(columnId);
  if (typeof a === "string" && typeof b === "string") return a.localeCompare(b);
  return (a as number) - (b as number);
};

export function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  defaultSortKey,
  defaultSortDir = "asc",
  emptyMessage = "Nenhum registro encontrado.",
  emptyState,
  errorTitle = "Não foi possível carregar os dados",
  errorState,
  loadingRows = 6,
  minWidth,
  maxHeight,
  enableRowSelection = false,
  onSelectionChange,
  columnVisibility,
}: DataTableProps<T>) {
  const { rows, isPending = false, error = null } = data;

  const [sorting, setSorting] = useState<SortingState>(
    defaultSortKey ? [{ id: defaultSortKey, desc: defaultSortDir === "desc" }] : [],
  );
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const tableColumns = useMemo<TanstackColumnDef<T>[]>(
    () =>
      columns.map((col) => ({
        id: col.key,
        enableSorting: !!col.getSortValue,
        sortingFn: mixedSortingFn as SortingFn<T>,
        // Primeiro clique sempre ascendente (paridade com a versão anterior);
        // o TanStack usaria "descending first" em colunas numéricas.
        sortDescFirst: false,
        sortUndefined: "last",
        accessorFn: col.getSortValue
          ? (row: T) => {
              const v = col.getSortValue!(row);
              // Não-finito vira undefined para o sortUndefined empurrá-lo ao fim.
              return typeof v === "number" && !isFinite(v) ? undefined : v;
            }
          : undefined,
      })),
    [columns],
  );

  const table = useReactTable<T>({
    data: rows,
    columns: tableColumns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => rowKey(row),
    enableRowSelection,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Notifica o consumidor sobre a seleção corrente (linhas originais).
  useEffect(() => {
    if (!onSelectionChange) return;
    onSelectionChange(table.getSelectedRowModel().rows.map((r) => r.original));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection]);

  const visibleColumns = columnVisibility
    ? columns.filter((c) => columnVisibility[c.key] !== false)
    : columns;
  const totalCols = visibleColumns.length + (enableRowSelection ? 1 : 0);

  const selectionHead = enableRowSelection ? (
    <TableHead className="w-10 sticky left-0 z-20 bg-muted/50">
      <Checkbox
        checked={
          table.getIsAllRowsSelected()
            ? true
            : table.getIsSomeRowsSelected()
              ? "indeterminate"
              : false
        }
        onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
        aria-label="Selecionar todas as linhas"
      />
    </TableHead>
  ) : null;

  const headerCells = visibleColumns.map((col) => {
    const sortable = !!col.getSortValue;
    const sortState = sorting.find((s) => s.id === col.key);
    const isActive = !!sortState && sortable;
    const SortIcon = !isActive ? ChevronsUpDown : sortState!.desc ? ChevronDown : ChevronUp;
    return (
      <TableHead
        key={col.key}
        aria-sort={isActive ? (sortState!.desc ? "descending" : "ascending") : undefined}
        className={cn(
          col.align && alignClass[col.align],
          col.stickyLeft && "sticky left-0 z-20 bg-muted/50",
          col.className,
        )}
      >
        {sortable ? (
          <button
            type="button"
            onClick={() => table.getColumn(col.key)?.toggleSorting()}
            className={cn(
              "inline-flex items-center gap-1 hover:text-foreground transition-colors",
              col.align === "end" && "flex-row-reverse",
              isActive && "text-foreground",
            )}
          >
            {col.header}
            <SortIcon className="h-3.5 w-3.5 opacity-60" aria-hidden />
          </button>
        ) : (
          col.header
        )}
      </TableHead>
    );
  });

  const renderBody = () => {
    if (error) {
      return (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={totalCols} className="py-14">
            {errorState ?? (
              <div className="flex flex-col items-center justify-center text-center px-6" role="alert">
                <AlertCircle className="h-8 w-8 text-destructive mb-3" aria-hidden />
                <p className="text-sm font-semibold text-foreground mb-1">{errorTitle}</p>
                <p className="text-sm text-muted-foreground max-w-md">{error.message}</p>
              </div>
            )}
          </TableCell>
        </TableRow>
      );
    }

    if (isPending) {
      return Array.from({ length: loadingRows }).map((_, i) => (
        <TableRow key={`sk-${i}`} className="hover:bg-transparent">
          {enableRowSelection && (
            <TableCell className="sticky left-0 z-10 bg-card">
              <Skeleton className="h-4 w-4" />
            </TableCell>
          )}
          {visibleColumns.map((col) => (
            <TableCell
              key={col.key}
              className={cn(col.stickyLeft && "sticky left-0 z-10 bg-card", col.className)}
            >
              <Skeleton
                className={cn("h-4 w-3/4", col.align === "end" && "ml-auto", col.align === "center" && "mx-auto")}
              />
            </TableCell>
          ))}
        </TableRow>
      ));
    }

    const bodyRows = table.getRowModel().rows;
    if (bodyRows.length === 0) {
      return (
        <TableRow className="hover:bg-transparent">
          <TableCell
            colSpan={totalCols}
            className={cn(!emptyState && "py-14 text-center text-sm text-muted-foreground")}
          >
            {emptyState ?? emptyMessage}
          </TableCell>
        </TableRow>
      );
    }

    return bodyRows.map((row) => (
      <TableRow
        key={row.id}
        data-state={row.getIsSelected() ? "selected" : undefined}
        onClick={onRowClick ? () => onRowClick(row.original) : undefined}
        className={cn(onRowClick && "cursor-pointer")}
      >
        {enableRowSelection && (
          <TableCell className="sticky left-0 z-10 bg-card" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(v) => row.toggleSelected(!!v)}
              aria-label="Selecionar linha"
            />
          </TableCell>
        )}
        {visibleColumns.map((col) => (
          <TableCell
            key={col.key}
            className={cn(
              col.align && alignClass[col.align],
              col.stickyLeft && "sticky left-0 z-10 bg-card",
              col.className,
            )}
          >
            {col.cell(row.original)}
          </TableCell>
        ))}
      </TableRow>
    ));
  };

  return (
    <div className={cn("w-full", maxHeight && "overflow-y-auto")} style={maxHeight ? { maxHeight } : undefined}>
      <Table style={minWidth ? { minWidth } : undefined}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {selectionHead}
            {headerCells}
          </TableRow>
        </TableHeader>
        <TableBody>{renderBody()}</TableBody>
      </Table>
    </div>
  );
}

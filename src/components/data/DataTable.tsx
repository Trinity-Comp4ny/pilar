import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertCircle, ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
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
  /** Título do estado de erro. */
  errorTitle?: string;
  /** Nº de linhas do skeleton de carregamento. */
  loadingRows?: number;
  /** Largura mínima da tabela (rolagem horizontal abaixo disso). */
  minWidth?: string;
  /** Altura máxima com rolagem vertical. */
  maxHeight?: string;
}

const alignClass: Record<NonNullable<ColumnDef<unknown>["align"]>, string> = {
  start: "text-left",
  end: "text-right",
  center: "text-center",
};

export function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  defaultSortKey,
  defaultSortDir = "asc",
  emptyMessage = "Nenhum registro encontrado.",
  errorTitle = "Não foi possível carregar os dados",
  loadingRows = 6,
  minWidth,
  maxHeight,
}: DataTableProps<T>) {
  const { rows, isPending = false, error = null } = data;

  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultSortDir);

  const activeCol = columns.find((c) => c.key === sortKey && c.getSortValue);

  const sortedRows = useMemo(() => {
    if (!activeCol?.getSortValue) return rows;
    const dir = sortDir === "asc" ? 1 : -1;
    const getValue = activeCol.getSortValue;
    return [...rows].sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      // Empurra valores não-finitos (missing) para o fim, independente da direção.
      const aInf = typeof av === "number" && !isFinite(av);
      const bInf = typeof bv === "number" && !isFinite(bv);
      if (aInf && bInf) return 0;
      if (aInf) return 1;
      if (bInf) return -1;
      if (typeof av === "string" && typeof bv === "string") return dir * av.localeCompare(bv);
      return dir * ((av as number) - (bv as number));
    });
  }, [rows, activeCol, sortDir]);

  const handleSort = (col: ColumnDef<T>) => {
    if (!col.getSortValue) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col.key);
      setSortDir("asc");
    }
  };

  const headerCells = columns.map((col) => {
    const sortable = !!col.getSortValue;
    const isActive = sortKey === col.key && sortable;
    const SortIcon = !isActive ? ChevronsUpDown : sortDir === "asc" ? ChevronUp : ChevronDown;
    return (
      <TableHead
        key={col.key}
        aria-sort={isActive ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
        className={cn(
          col.align && alignClass[col.align],
          col.stickyLeft && "sticky left-0 z-20 bg-muted/50",
          col.className,
        )}
      >
        {sortable ? (
          <button
            type="button"
            onClick={() => handleSort(col)}
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
          <TableCell colSpan={columns.length} className="py-14">
            <div className="flex flex-col items-center justify-center text-center px-6" role="alert">
              <AlertCircle className="h-8 w-8 text-destructive mb-3" aria-hidden />
              <p className="text-sm font-semibold text-foreground mb-1">{errorTitle}</p>
              <p className="text-sm text-muted-foreground max-w-md">{error.message}</p>
            </div>
          </TableCell>
        </TableRow>
      );
    }

    if (isPending) {
      return Array.from({ length: loadingRows }).map((_, i) => (
        <TableRow key={`sk-${i}`} className="hover:bg-transparent">
          {columns.map((col) => (
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

    if (sortedRows.length === 0) {
      return (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={columns.length} className="py-14 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </TableCell>
        </TableRow>
      );
    }

    return sortedRows.map((row) => (
      <TableRow
        key={rowKey(row)}
        onClick={onRowClick ? () => onRowClick(row) : undefined}
        className={cn(onRowClick && "cursor-pointer")}
      >
        {columns.map((col) => (
          <TableCell
            key={col.key}
            className={cn(
              col.align && alignClass[col.align],
              col.stickyLeft && "sticky left-0 z-10 bg-card",
              col.className,
            )}
          >
            {col.cell(row)}
          </TableCell>
        ))}
      </TableRow>
    ));
  };

  return (
    <div className={cn("w-full", maxHeight && "overflow-y-auto")} style={maxHeight ? { maxHeight } : undefined}>
      <Table style={minWidth ? { minWidth } : undefined}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">{headerCells}</TableRow>
        </TableHeader>
        <TableBody>{renderBody()}</TableBody>
      </Table>
    </div>
  );
}

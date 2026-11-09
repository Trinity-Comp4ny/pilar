import { cn } from "@/lib/utils";
import { TABLE_HEAD_CLASS } from "@/components/ui/table";

interface SortableTHProps<K extends string> {
  label: string;
  k: K;
  sort: { key: K; dir: "asc" | "desc" };
  onSort: (k: K) => void;
  icon: React.ReactNode;
  className?: string;
}

/** Cabeçalho clicável de coluna da tabela de lançamentos, com o visual do `DataTable` (SPEC 127). */
export function SortableTH<K extends string>({ label, k, sort, onSort, icon, className }: SortableTHProps<K>) {
  const active = sort.key === k;
  return (
    <th
      className={cn(TABLE_HEAD_CLASS, "h-11 px-3 cursor-pointer select-none whitespace-nowrap", className)}
      onClick={() => onSort(k)}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground transition-colors",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        {icon}
      </span>
    </th>
  );
}

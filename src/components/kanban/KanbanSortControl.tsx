import { ArrowUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  KANBAN_SORT_DIR_LABELS,
  KANBAN_SORT_LABELS,
  type KanbanSort,
  type KanbanSortDir,
  type KanbanSortKey,
} from "@/lib/kanbanSort";

type Props = {
  sort: KanbanSort;
  onChange: (sort: KanbanSort) => void;
  /** Chaves que o quadro sabe ordenar, na ordem em que aparecem no menu. */
  keys: readonly KanbanSortKey[];
};

/**
 * Controle de ordenação único dos quadros (Tarefas, Projetos, Leads): mesma
 * pílula, mesmo menu, mesmos rótulos. O que muda por tela é só `keys`.
 */
export function KanbanSortControl({ sort, onChange, keys }: Props) {
  const dirs: KanbanSortDir[] = ["asc", "desc"];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-9 gap-1.5 rounded-full px-3.5 text-[13px] font-normal"
          aria-label="Ordenar"
        >
          <ArrowUpDown size={14} className="text-black/50" />
          <span className="hidden sm:inline">{KANBAN_SORT_LABELS[sort.key]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Ordenar por</DropdownMenuLabel>
        {keys.map((key) => (
          <DropdownMenuItem
            key={key}
            onClick={() => onChange({ ...sort, key })}
            className={cn("text-[13px]", sort.key === key && "font-medium")}
          >
            {KANBAN_SORT_LABELS[key]}
            {sort.key === key && <Check className="ml-auto h-4 w-4 text-brand" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {dirs.map((dir) => (
          <DropdownMenuItem
            key={dir}
            onClick={() => onChange({ ...sort, dir })}
            className={cn("text-[13px]", sort.dir === dir && "font-medium")}
          >
            {KANBAN_SORT_DIR_LABELS[sort.key][dir]}
            {sort.dir === dir && <Check className="ml-auto h-4 w-4 text-brand" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

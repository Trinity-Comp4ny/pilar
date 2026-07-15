import { ArrowDownAZ, ArrowUpDown, ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
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
import { SORT_LABELS, type SortKey, type SortDir } from "@/pages/projetos/lib/sort";

interface SortControlProps {
  sort: { key: SortKey; dir: SortDir };
  onChange: (sort: { key: SortKey; dir: SortDir }) => void;
}

// Ordenação global do quadro, sempre visível na barra de topo (antes ficava
// escondida por coluna, aparecendo só no hover e inalcançável por toque/teclado).
export function SortControl({ sort, onChange }: SortControlProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-9 rounded-full text-sm gap-2" aria-label="Ordenar projetos">
          <ArrowUpDown className="h-4 w-4" />
          <span className="hidden sm:inline">Ordenar: {SORT_LABELS[sort.key]}</span>
          {sort.dir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide">Ordenar por</DropdownMenuLabel>
        {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
          <DropdownMenuItem
            key={k}
            onClick={() => onChange({ ...sort, key: k })}
            className={cn("text-xs", sort.key === k && "bg-muted font-medium")}
          >
            {k === "name" && <ArrowDownAZ className="h-3.5 w-3.5 mr-2" />}
            {SORT_LABELS[k]}
            {sort.key === k && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-xs"
          onClick={() => onChange({ ...sort, dir: sort.dir === "asc" ? "desc" : "asc" })}
        >
          {sort.dir === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5 mr-2" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 mr-2" />
          )}
          Direção: {sort.dir === "asc" ? "Crescente" : "Decrescente"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

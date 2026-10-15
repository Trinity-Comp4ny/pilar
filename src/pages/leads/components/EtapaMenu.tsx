import { ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  primeira: boolean;
  ultima: boolean;
  onEditar: () => void;
  onMover: (dir: -1 | 1) => void;
  onExcluir: () => void;
};

/** Menu da coluna do funil: editar, mover para os lados e excluir. */
export function EtapaMenu({ primeira, ultima, onEditar, onMover, onExcluir }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px] text-muted-foreground"
          aria-label="Ações da coluna"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEditar}>
          <Pencil className="mr-2 h-4 w-4" /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem disabled={primeira} onClick={() => onMover(-1)}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Mover para esquerda
        </DropdownMenuItem>
        <DropdownMenuItem disabled={ultima} onClick={() => onMover(1)}>
          <ChevronRight className="mr-2 h-4 w-4" /> Mover para direita
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onExcluir}>
          <Trash2 className="mr-2 h-4 w-4" /> Excluir coluna
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

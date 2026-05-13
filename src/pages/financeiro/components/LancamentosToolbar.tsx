import { ChevronsDown, ChevronsUp, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  grouped: boolean;
  allGroupIds: string[];
  allExpanded: boolean;
  onToggleGrouped: () => void;
  onToggleExpandAll: () => void;
}

export function LancamentosToolbar({
  grouped,
  allGroupIds,
  allExpanded,
  onToggleGrouped,
  onToggleExpandAll,
}: Props) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleGrouped}
        className="h-8 px-2 text-xs gap-1 text-muted-foreground"
        title={grouped ? "Desagrupar parcelas" : "Agrupar parcelas"}
      >
        <Layers className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{grouped ? "Parcelas agrupadas" : "Agrupar parcelas"}</span>
      </Button>
      {grouped && allGroupIds.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleExpandAll}
          className="h-8 px-2 text-xs gap-1 text-muted-foreground"
          title={allExpanded ? "Recolher todos os grupos" : "Expandir todos os grupos"}
        >
          {allExpanded ? <ChevronsUp className="h-3.5 w-3.5" /> : <ChevronsDown className="h-3.5 w-3.5" />}
        </Button>
      )}
    </div>
  );
}

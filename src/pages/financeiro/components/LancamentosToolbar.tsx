import { ChevronsDown, ChevronsUp, Layers, Rows3, Rows4 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Density = "comfortable" | "compact";

interface Props {
  grouped: boolean;
  density: Density;
  allGroupIds: string[];
  allExpanded: boolean;
  onToggleGrouped: () => void;
  onToggleExpandAll: () => void;
  onToggleDensity: () => void;
}

export function LancamentosToolbar({
  grouped,
  density,
  allGroupIds,
  allExpanded,
  onToggleGrouped,
  onToggleExpandAll,
  onToggleDensity,
}: Props) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleGrouped}
        className={cn("h-8 px-2 text-xs gap-1", grouped ? "text-brand" : "text-muted-foreground")}
        title={grouped ? "Desagrupar parcelas" : "Agrupar parcelas"}
      >
        <Layers className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{grouped ? "Agrupado" : "Agrupar"}</span>
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
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleDensity}
        className="h-8 px-2 text-xs gap-1 text-muted-foreground"
        title={density === "compact" ? "Densidade confortável" : "Densidade compacta"}
      >
        {density === "compact" ? <Rows3 className="h-3.5 w-3.5" /> : <Rows4 className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

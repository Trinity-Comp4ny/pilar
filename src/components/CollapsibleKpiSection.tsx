import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { usePersistedOpen } from "@/hooks/usePersistedOpen";
import { cn } from "@/lib/utils";

interface CollapsibleKpiSectionProps {
  /** Chave única da tela (ex.: "leads", "projetos"), namespaced na persistência. */
  storageKey: string;
  /** Conteúdo dos KPIs (o grid de `KPICard`), some quando a faixa está fechada. */
  children: React.ReactNode;
  /**
   * Controles que ficam na MESMA linha do trigger "Indicadores" (toggle
   * Quadro/Lista, ordenação, filtros), em vez de linhas empilhadas à parte.
   * É o que evita 3 linhas curtas (spec 061, feedback do Matheus 25/08).
   */
  controls?: React.ReactNode;
  label?: string;
}

/**
 * Faixa de KPIs que o usuário pode recolher pra dar mais altura ao conteúdo
 * principal (board/lista) abaixo. Estado lembrado por navegador (spec 061).
 */
export function CollapsibleKpiSection({
  storageKey,
  children,
  controls,
  label = "Indicadores",
}: CollapsibleKpiSectionProps) {
  const [open, setOpen] = usePersistedOpen(`kpis-${storageKey}`);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex-shrink-0 mb-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} />
          {label}
        </CollapsibleTrigger>
        {controls && <div className="flex flex-wrap items-center gap-2">{controls}</div>}
      </div>
      <CollapsibleContent>
        <div className="pt-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

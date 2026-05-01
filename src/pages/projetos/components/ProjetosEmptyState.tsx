import { Button } from "@/components/ui/button";
import { Layers, Plus, SearchX } from "lucide-react";

interface ProjetosEmptyStateProps {
  variant: "no-projetos" | "no-results";
  onCreate?: () => void;
  onClearFilters?: () => void;
}

export function ProjetosEmptyState({ variant, onCreate, onClearFilters }: ProjetosEmptyStateProps) {
  if (variant === "no-results") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <SearchX className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Nenhum projeto encontrado</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Ajuste os filtros ou limpe a busca para ver mais projetos.
        </p>
        {onClearFilters && (
          <Button variant="outline" size="sm" className="mt-4" onClick={onClearFilters}>
            Limpar filtros
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-14 w-14 rounded-full bg-brand/10 flex items-center justify-center mb-3">
        <Layers className="h-7 w-7 text-brand" />
      </div>
      <p className="text-base font-semibold">Nenhum projeto cadastrado</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        Cadastre seu primeiro projeto para começar a acompanhar disciplinas, prazos e pagamentos.
      </p>
      {onCreate && (
        <Button className="mt-4 bg-brand hover:bg-brand/90 text-ink" onClick={onCreate}>
          <Plus className="h-4 w-4 mr-2" /> Criar primeiro projeto
        </Button>
      )}
    </div>
  );
}

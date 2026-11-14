import { useMemo } from "react";
import { caminhoDoNo } from "@/pages/obras/lib/obraArvore";
import { useObraFrentes } from "@/pages/obras/hooks/useObraFrentes";
import { TarefasWorkspace, type MolduraTarefasProps } from "@/pages/meu-trabalho/TarefasWorkspace";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageToolbar } from "@/components/PageSlots";

/**
 * Moldura da aba: visão, filtros, busca e ação vão para a barra da página (`PageToolbar`), logo
 * abaixo das abas, como em Gestão > Tarefas. Antes eram uma linha dentro do conteúdo, que no
 * celular quebrava em duas (auditoria de espaço, 2026-11).
 */
function MolduraAba({ toolbar, search, primaryAction, children }: MolduraTarefasProps) {
  return (
    <div className="space-y-3">
      <PageToolbar inlineSemLayout>
        <div className="flex items-center gap-2 overflow-x-auto px-4 py-2 md:px-6 scrollbar-none">
          <div className="min-w-0 flex-1 [&>[role=toolbar]]:px-0 md:[&>[role=toolbar]]:px-0">{toolbar}</div>
          {search && (
            <div className="relative w-56 max-w-full shrink-0 max-md:w-40">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder ?? "Buscar"}
                aria-label={search.placeholder ?? "Buscar"}
                className="h-9 rounded-full pl-8"
              />
            </div>
          )}
          {primaryAction && (
            <Button variant="brand" onClick={primaryAction.onClick} className="shrink-0">
              <primaryAction.icon className="mr-1.5 h-4 w-4" aria-hidden />
              {primaryAction.label}
            </Button>
          )}
        </div>
      </PageToolbar>
      {children}
    </div>
  );
}

/**
 * Aba Tarefas da obra (SPEC 140): a mesma lista e o mesmo quadro de Gestão > Tarefas, só com as
 * tarefas desta obra. Nova tarefa nasce na obra, com o serviço do cronograma como campo opcional.
 */
export function ObraTarefasTab({ obraId, aoMontarCronograma }: { obraId: string; aoMontarCronograma: () => void }) {
  const { data: nos } = useObraFrentes(obraId);
  const servicos = useMemo(
    () =>
      (nos ?? [])
        .filter((n) => n.nivel === "servico")
        .map((n) => ({ id: n.id, caminho: caminhoDoNo(nos ?? [], n.id) }))
        .sort((a, b) => a.caminho.localeCompare(b.caminho, "pt-BR")),
    [nos]
  );

  return <TarefasWorkspace moldura={MolduraAba} obra={{ id: obraId, servicos, aoMontarCronograma }} />;
}

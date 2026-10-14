import { useCallback, useMemo, useState } from "react";
import { GanttChart, List, ListTree } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import { caminhoDoNo, montarArvoreCronograma } from "@/pages/obras/lib/obraArvore";
import { useObraFrentes } from "@/pages/obras/hooks/useObraFrentes";
import { useObraTarefas } from "@/pages/obras/hooks/useObraTarefas";
import { usePessoasEmpresa } from "@/pages/meu-trabalho/hooks";
import { CronogramaLista } from "./cronograma/CronogramaLista";
import { CronogramaGantt } from "./cronograma/CronogramaGantt";
import { useCronogramaAcoes } from "./cronograma/useCronogramaAcoes";

type Visao = "lista" | "gantt";
const VISAO_KEY = "pilar:obra-cronograma-visao";

function visaoSalva(): Visao {
  try {
    return localStorage.getItem(VISAO_KEY) === "gantt" ? "gantt" : "lista";
  } catch {
    return "lista";
  }
}

/**
 * Cronograma da obra em quatro níveis (spec 111): fase > etapa > serviço > tarefa.
 * A Lista é onde se monta e marca o checklist; o Gantt é onde se lê e ajusta prazo.
 * As duas leem a mesma árvore e o mesmo estado de recolhido.
 */
export function ObraCronogramaTab({
  obraId,
  projetoId,
  canEdit,
}: {
  obraId: string;
  projetoId: string | null;
  canEdit: boolean;
}) {
  const { data: nos = [], isLoading } = useObraFrentes(obraId);
  const { data: tarefas = [] } = useObraTarefas(obraId);
  const { data: pessoas = [] } = usePessoasEmpresa();
  const acoes = useCronogramaAcoes(obraId, projetoId, nos);

  const [visao, setVisao] = useState<Visao>(visaoSalva);
  // Recolhidos por id. Vazio = tudo aberto.
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const [adicionando, setAdicionando] = useState<{ parentId: string | null } | null>(null);

  const { fases, soltas } = useMemo(() => montarArvoreCronograma(nos, tarefas), [nos, tarefas]);
  const servicos = useMemo(() => nos.filter((n) => n.nivel === "servico"), [nos]);
  const caminho = useCallback((id: string) => caminhoDoNo(nos, id), [nos]);

  const trocarVisao = (v: Visao) => {
    setVisao(v);
    try {
      localStorage.setItem(VISAO_KEY, v);
    } catch {
      // Sem storage (modo privado): a escolha vale só nesta sessão.
    }
  };

  const toggle = useCallback(
    (id: string) =>
      setRecolhidos((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    []
  );

  const expandir = useCallback(
    (id: string) =>
      setRecolhidos((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      }),
    []
  );

  if (isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;

  if (fases.length === 0 && soltas.length === 0 && adicionando === null) {
    return (
      <EmptyState
        icon={ListTree}
        title="Monte o cronograma da obra"
        description="Comece pela fase (ex.: Estrutura). Dentro dela vêm as etapas (Fundação), os serviços (Sapatas) e as tarefas que a equipe marca como feitas."
        action={
          canEdit
            ? { label: "Criar primeira fase", onClick: () => setAdicionando({ parentId: null }), variant: "brand" }
            : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg border bg-muted/40 p-0.5" role="tablist" aria-label="Visão do cronograma">
        {(
          [
            { v: "lista", label: "Lista", Icon: List },
            { v: "gantt", label: "Gantt", Icon: GanttChart },
          ] as const
        ).map(({ v, label, Icon }) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={visao === v}
            onClick={() => trocarVisao(v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm transition-colors",
              visao === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {visao === "lista" ? (
        <CronogramaLista
          fases={fases}
          soltas={soltas}
          servicos={servicos}
          caminho={caminho}
          recolhidos={recolhidos}
          onToggle={toggle}
          onExpandir={expandir}
          canEdit={canEdit}
          pessoas={pessoas}
          acoes={acoes}
          adicionando={adicionando}
          setAdicionando={setAdicionando}
        />
      ) : (
        <CronogramaGantt
          fases={fases}
          recolhidos={recolhidos}
          onToggle={toggle}
          canEdit={canEdit}
          acoes={acoes}
          onIrParaLista={() => trocarVisao("lista")}
        />
      )}
    </div>
  );
}

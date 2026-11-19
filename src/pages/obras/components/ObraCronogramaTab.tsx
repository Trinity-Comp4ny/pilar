import { useCallback, useMemo, useState } from "react";
import { ViewSwitcher, type ViewOption } from "@/components/ViewSwitcher";
import { FileSpreadsheet, GanttChart, GitBranch, List, ListTree, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { caminhoDoNo, montarArvoreCronograma } from "@/pages/obras/lib/obraArvore";
import { useObraFrentes } from "@/pages/obras/hooks/useObraFrentes";
import { usePermissions } from "@/hooks/usePermissions";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { useObraConta } from "@/pages/obras/hooks/useObraConta";
import { useObraOrcamento } from "@/pages/obras/hooks/useObraOrcamento";
import { achatarOrcado, montarOrcadoRealizado } from "@/lib/orcadoRealizado";
import { calcularSaldoConta, realizadoPorEtapa, SEM_ETAPA } from "@/lib/obras";
import { agruparPlanejamentoManual, useObraPlanejamentoMes } from "@/pages/obras/hooks/useObraPlanejamentoMes";
import { montarFisicoFinanceiro, periodosPorNo } from "@/pages/obras/lib/fisicoFinanceiro";
import { useObraTarefas } from "@/pages/obras/hooks/useObraTarefas";
import { usePessoasEmpresa } from "@/hooks/tarefas/useTarefas";
import { AplicarFluxoObraDialog } from "./AplicarFluxoObraDialog";
import { SalvarComoFluxoDialog } from "./SalvarComoFluxoDialog";
import { useFluxosObra } from "@/pages/obras/hooks/useFluxosObra";
import { ImportarCronogramaDialog } from "./ImportarCronogramaDialog";
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
const CRONOGRAMA_VISOES: ViewOption<"lista" | "gantt">[] = [
  { value: "lista", label: "Lista", icon: List },
  { value: "gantt", label: "Gantt", icon: GanttChart },
];

export function ObraCronogramaTab({
  obraId,
  projetoId,
  canEdit,
  inicioPrevisto,
  nomeDaObra,
}: {
  obraId: string;
  projetoId: string | null;
  canEdit: boolean;
  /** Início previsto da obra: sugestão de data ao aplicar um fluxo. */
  inicioPrevisto?: string | null;
  nomeDaObra?: string;
}) {
  const { data: nos = [], isLoading } = useObraFrentes(obraId);
  const { data: tarefas = [] } = useObraTarefas(obraId);
  const { data: pessoas = [] } = usePessoasEmpresa();
  const acoes = useCronogramaAcoes(obraId, projetoId, nos);

  // Financeiro dentro do cronograma: orçado e realizado de cada fase, etapa e serviço (só para quem vê dinheiro).
  const { can } = usePermissions();
  const veFinanceiro = can("obras_conta", "view") && can("financeiro");
  const formatCurrency = useMoneyMask();
  const { data: lancamentos = [] } = useObraConta(veFinanceiro ? obraId : undefined);
  const { data: orcamentos = [] } = useObraOrcamento(veFinanceiro ? obraId : undefined);
  const { data: planejamentoManual } = useObraPlanejamentoMes(veFinanceiro ? obraId : undefined);
  const orcado = useMemo(() => {
    if (!veFinanceiro) return null;
    const prev = new Map(orcamentos.map((o) => [o.obra_frente_id, Number(o.valor_previsto)]));
    const real = realizadoPorEtapa(lancamentos);
    return montarOrcadoRealizado(nos, prev, real, real[SEM_ETAPA] ?? 0);
  }, [veFinanceiro, nos, orcamentos, lancamentos]);
  const despesasDoGantt = useMemo(
    () => lancamentos.filter((l) => l.tipo === "despesa").map((l) => ({ data: l.data, valor: Number(l.valor) })),
    [lancamentos]
  );
  const financeiro = useMemo(
    () =>
      orcado
        ? new Map(achatarOrcado(orcado.raizes).map((l) => [l.no.id, { previsto: l.previsto, realizado: l.realizado }]))
        : undefined,
    [orcado]
  );

  const [visao, setVisao] = useState<Visao>(visaoSalva);
  // Recolhidos por id. Vazio = tudo aberto.
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const [importando, setImportando] = useState(false);
  const [aplicandoFluxo, setAplicandoFluxo] = useState(false);
  const [salvandoFluxo, setSalvandoFluxo] = useState(false);
  const { data: fluxos = [] } = useFluxosObra();
  const [adicionando, setAdicionando] = useState<{ parentId: string | null } | null>(null);

  const { fases, soltas } = useMemo(() => montarArvoreCronograma(nos, tarefas), [nos, tarefas]);

  // Mesma conta da grade Físico-financeiro (spec 165): o Gantt só mostra o resultado, com o ajuste manual junto.
  const fisicoFinanceiro = useMemo(() => {
    if (!orcado) return null;
    return montarFisicoFinanceiro(
      orcado.raizes,
      periodosPorNo(fases),
      agruparPlanejamentoManual(planejamentoManual ?? [])
    );
  }, [orcado, fases, planejamentoManual]);
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

  const dialogoImportar = canEdit && (
    <ImportarCronogramaDialog
      open={importando}
      onOpenChange={setImportando}
      obraId={obraId}
      projetoId={projetoId}
      fasesExistentes={fases.length}
    />
  );

  const dialogosFluxo = canEdit && (
    <>
      <AplicarFluxoObraDialog
        key={`aplicar-${aplicandoFluxo}`}
        open={aplicandoFluxo}
        onOpenChange={setAplicandoFluxo}
        obraId={obraId}
        projetoId={projetoId}
        fasesExistentes={fases.length}
        inicioPadrao={inicioPrevisto}
      />
      {salvandoFluxo && (
        <SalvarComoFluxoDialog
          open
          onOpenChange={setSalvandoFluxo}
          nos={nos}
          tarefas={tarefas}
          nomeSugerido={nomeDaObra ?? "da obra"}
          obraId={obraId}
        />
      )}
    </>
  );

  if (fases.length === 0 && soltas.length === 0 && adicionando === null) {
    return (
      <>
        <EmptyState
          icon={ListTree}
          title="Monte o cronograma da obra"
          description="Comece pela fase (ex.: Estrutura). Dentro dela vêm as etapas (Fundação), os serviços (Sapatas) e as tarefas que a equipe marca como feitas."
          action={
            canEdit
              ? { label: "Criar primeira fase", onClick: () => setAdicionando({ parentId: null }), variant: "brand" }
              : undefined
          }
        >
          {canEdit && (
            <Button variant="outline" className="mt-2" onClick={() => setImportando(true)}>
              <FileSpreadsheet className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Importar de planilha
            </Button>
          )}
        </EmptyState>
        {dialogoImportar}
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <ViewSwitcher
          options={CRONOGRAMA_VISOES}
          value={visao}
          onChange={trocarVisao}
          ariaLabel="Visão do cronograma"
        />
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {fluxos.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setAplicandoFluxo(true)}>
                <GitBranch className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Aplicar fluxo
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setSalvandoFluxo(true)}>
              <Save className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Salvar como fluxo
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportando(true)}>
              <FileSpreadsheet className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Importar planilha
            </Button>
          </div>
        )}
      </div>

      {orcado && (
        <div className="grid grid-cols-3 gap-3 rounded-2xl border border-black/5 bg-white p-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Orçado</p>
            <p className="font-semibold tabular-nums text-ink">
              {orcado.totalPrevisto > 0 ? formatCurrency(orcado.totalPrevisto) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Realizado</p>
            <p
              className={
                orcado.totalPrevisto > 0 && orcado.totalRealizado > orcado.totalPrevisto
                  ? "font-semibold tabular-nums text-danger-strong"
                  : "font-semibold tabular-nums text-ink"
              }
            >
              {formatCurrency(orcado.totalRealizado)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Saldo da conta</p>
            <p className="font-semibold tabular-nums text-ink">{formatCurrency(calcularSaldoConta(lancamentos))}</p>
          </div>
        </div>
      )}

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
          financeiro={financeiro}
        />
      ) : (
        <CronogramaGantt
          fases={fases}
          recolhidos={recolhidos}
          onToggle={toggle}
          canEdit={canEdit}
          acoes={acoes}
          onIrParaLista={() => trocarVisao("lista")}
          orcado={orcado}
          fisicoFinanceiro={fisicoFinanceiro}
          despesas={despesasDoGantt}
        />
      )}
      {dialogoImportar}
      {dialogosFluxo}
    </div>
  );
}

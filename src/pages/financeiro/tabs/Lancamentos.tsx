import { useCallback, useEffect, useMemo, useState } from "react";
import { KPICard } from "@/components/KPICard";
import { KpiResumo } from "@/components/KpiResumo";
import { CollapsibleKpiSection } from "@/components/CollapsibleKpiSection";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { DataFrescor } from "@/components/DataFrescor";
import { Clock, TrendingDown, TrendingUp, Upload } from "lucide-react";
import { LancamentosTable } from "../components/LancamentosTable";
import { PosicaoChips } from "../components/PosicaoChips";
import { baldeAtivo, filtroDoBalde } from "../components/posicaoFiltros";
import { useTitulosPosicao } from "../hooks/useTitulosPosicao";
import { useLancamentosResumo } from "../hooks/useLancamentosResumo";
import { ImportarLancamentosDialog } from "../components/ImportarLancamentosDialog";
import { FinanceErrorState } from "../components/FinanceErrorState";
import {
  periodoRange,
  readFiltersFromParams,
  writeFiltersToParams,
  type LancamentosFilters,
} from "../components/lancamentosFilters";

/** Invalida as três queries da tela (página, resumo, grupos) de uma vez. */
export function invalidateLancamentos(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["lancamentos-pagina"] });
  qc.invalidateQueries({ queryKey: ["lancamentos-resumo"] });
  qc.invalidateQueries({ queryKey: ["grupos-parcela-resumo"] });
  qc.invalidateQueries({ queryKey: ["titulos-posicao"] });
}

type Visao = "despesa" | "receita" | "todos";
const VISAO_STORAGE_KEY = "pilar:financeiro:lancamentos:visao";

function lerVisaoSalva(): Visao | null {
  try {
    const v = localStorage.getItem(VISAO_STORAGE_KEY);
    return v === "despesa" || v === "receita" || v === "todos" ? v : null;
  } catch {
    return null;
  }
}

function salvarVisao(v: Visao) {
  try {
    localStorage.setItem(VISAO_STORAGE_KEY, v);
  } catch {
    // Sem storage (aba privada): só não lembra a última visão.
  }
}

/** Rótulo legível do recorte de período ativo, para deixar o corte explícito. */
function recorteLabel(f: LancamentosFilters): string {
  if (f.periodo === "tudo") return "todo o período";
  if (f.periodo === "custom") {
    const de = f.customFrom ? format(parseISO(f.customFrom), "dd/MM/yyyy") : "…";
    const ate = f.customTo ? format(parseISO(f.customTo), "dd/MM/yyyy") : "…";
    return `${de} a ${ate}`;
  }
  const r = periodoRange(f);
  if (f.periodo === "mes-atual" || f.periodo === "mes-anterior") {
    return r.from ? format(parseISO(r.from), "MMMM 'de' yyyy", { locale: ptBR }) : f.periodo;
  }
  if (f.periodo === "ano") return r.from ? format(parseISO(r.from), "yyyy") : "este ano";
  if (f.periodo === "ultimos-30") return "últimos 30 dias";
  return f.periodo;
}

export default function Lancamentos() {
  // Filtros vivem na URL para persistir em refresh e compartilhamento de link.
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFiltersFromParams(searchParams), [searchParams]);
  const setFilters = useCallback(
    (next: LancamentosFilters) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          writeFiltersToParams(params, next);
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );
  const patchFilters = useCallback(
    (patch: Partial<LancamentosFilters>) => setFilters({ ...filters, ...patch }),
    [filters, setFilters]
  );

  const [importar, setImportar] = useState(false);
  // Resumo dos indicadores mascarado como os cards ("ocultar valores").
  const formatCurrency = useMoneyMask();

  // Visões A pagar / A receber / Tudo (SPEC 150): são o filtro de tipo promovido para o
  // topo, com a posição por vencimento em chips. A última visão usada volta ao abrir,
  // a menos que o link já traga filtros.
  const visao: Visao = filters.tipo;
  useEffect(() => {
    if (searchParams.toString().match(/(^|&)f[a-z]+=/)) return;
    const salva = lerVisaoSalva();
    if (salva && salva !== "todos") setFilters({ ...filters, tipo: salva, status: "pendentes" });
    // Só na montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const trocarVisao = (next: LancamentosFilters) => {
    const v = next.tipo;
    salvarVisao(v);
    if (v === "todos") {
      setFilters(next);
      return;
    }
    // Ao entrar em A pagar/A receber, o padrão é o que está em aberto.
    setFilters({ ...next, status: next.status === "todos" ? "pendentes" : next.status });
  };
  const tipoTitulos = visao === "todos" ? null : visao;
  const posicao = useTitulosPosicao(tipoTitulos);
  const ativo = posicao.data ? baldeAtivo(filters, posicao.data.hoje) : null;

  const queryClient = useQueryClient();
  const invalidate = () => invalidateLancamentos(queryClient);

  const {
    resumo,
    isLoading: loadingResumo,
    isError: erroResumo,
    isFetching: fetchingResumo,
    dataUpdatedAt: resumoUpdatedAt,
    refetch: refetchResumo,
  } = useLancamentosResumo(filters);

  // Recorte, frescor e importar numa linha só, à direita dos indicadores. Antes eram três
  // linhas acima dos KPIs, com um segundo seletor A pagar/A receber/Tudo que repetia o da
  // barra de filtros (auditoria de espaço, 2026-11: a 1ª linha da tabela estava em y=520).
  const linhaRecorte = (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-xs text-muted-foreground">
        Vendo <span className="font-medium text-foreground">{recorteLabel(filters)}</span> · por vencimento
      </p>
      <DataFrescor updatedAt={resumoUpdatedAt} isFetching={fetchingResumo} onRefresh={() => void refetchResumo()} />
      <Button size="xs" variant="outline" className="rounded-full gap-1" onClick={() => setImportar(true)}>
        <Upload className="h-3.5 w-3.5" />
        Importar
      </Button>
    </div>
  );

  return (
    <div className="space-y-4 w-full">
      {tipoTitulos ? (
        <>
          <div className="flex justify-end">{linhaRecorte}</div>
          <PosicaoChips
            tipo={tipoTitulos}
            posicao={posicao.data}
            loading={posicao.isLoading}
            ativo={ativo}
            onSelect={(b) => posicao.data && setFilters(filtroDoBalde(b, posicao.data.hoje, filters))}
          />
        </>
      ) : erroResumo ? (
        <>
          <div className="flex justify-end">{linhaRecorte}</div>
          <FinanceErrorState onRetry={() => void refetchResumo()} />
        </>
      ) : (
        // KPIs clicáveis (visão Tudo): cada um aplica o filtro correspondente. Recolhidos,
        // viram um resumo na mesma linha.
        <CollapsibleKpiSection
          storageKey="lancamentos"
          controls={linhaRecorte}
          resumo={
            loadingResumo ? undefined : (
              <KpiResumo
                itens={[
                  { texto: `recebido ${formatCurrency(resumo.recebido, { compact: true })}` },
                  { texto: `pago ${formatCurrency(resumo.pago, { compact: true })}` },
                  { texto: `a receber ${formatCurrency(resumo.aReceber, { compact: true })}` },
                  {
                    texto: `a pagar ${formatCurrency(resumo.aPagar, { compact: true })}${
                      resumo.atrasadosCount > 0 ? ` (${resumo.atrasadosCount} atrasados)` : ""
                    }`,
                    alerta: resumo.atrasadosCount > 0,
                  },
                ]}
              />
            )
          }
        >
          {/* Colunas pela largura real (container), não pela tela: com as duas sidebars,
              1024px de tela deixam ~480px aqui, e 4 cards cortavam o valor. */}
          <div className="@container">
            <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-4">
              <KPICard
                density="compact"
                label="Recebido"
                value={resumo.recebido}
                icon={TrendingUp}
                tone="positive"
                loading={loadingResumo}
                onClick={() => patchFilters({ tipo: "receita", status: "pagos" })}
              />
              <KPICard
                density="compact"
                label="Pago"
                value={resumo.pago}
                icon={TrendingDown}
                tone="danger"
                loading={loadingResumo}
                onClick={() => patchFilters({ tipo: "despesa", status: "pagos" })}
              />
              <KPICard
                density="compact"
                label="A receber"
                value={resumo.aReceber}
                icon={Clock}
                tone="info"
                loading={loadingResumo}
                onClick={() => patchFilters({ tipo: "receita", status: "pendentes" })}
              />
              <KPICard
                density="compact"
                label="A pagar"
                value={resumo.aPagar}
                icon={Clock}
                tone="warning"
                loading={loadingResumo}
                subtitle={resumo.atrasadosCount > 0 ? `${resumo.atrasadosCount} atrasado(s)` : undefined}
                subtitleTone="danger"
                onClick={() => patchFilters({ tipo: "despesa", status: "pendentes" })}
              />
            </div>
          </div>
        </CollapsibleKpiSection>
      )}

      {/* A tabela já tem moldura: sem card em volta (eram 2 bordas e 16 px de cada lado, que
        cortavam Valor e Status em 1320 px). Auditoria de espaço, 2026-11. */}
      <div>
        <LancamentosTable
          resumo={resumo}
          filters={filters}
          // O seletor de tipo da barra é o único agora: trocar por ele segue a regra das
          // visões (SPEC 150), que lembra a escolha e abre A pagar/A receber em aberto.
          onFiltersChange={(next) => (next.tipo !== filters.tipo ? trocarVisao(next) : setFilters(next))}
          onMutated={invalidate}
        />

        <ImportarLancamentosDialog open={importar} onOpenChange={setImportar} onImported={invalidate} />
      </div>
    </div>
  );
}

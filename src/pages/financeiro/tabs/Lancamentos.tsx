import { useCallback, useEffect, useMemo, useState } from "react";
import { KPICard } from "@/components/KPICard";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataFrescor } from "@/components/DataFrescor";
import { Clock, TrendingDown, TrendingUp, Upload } from "lucide-react";
import { LancamentosTable } from "../components/LancamentosTable";
import { ViewSwitcher } from "@/components/ViewSwitcher";
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
const VISOES = [
  { value: "despesa" as const, label: "A pagar" },
  { value: "receita" as const, label: "A receber" },
  { value: "todos" as const, label: "Tudo" },
];

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

  // Visões A pagar / A receber / Tudo (SPEC 149): são o filtro de tipo promovido para o
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
  const trocarVisao = (v: Visao) => {
    salvarVisao(v);
    if (v === "todos") {
      setFilters({ ...filters, tipo: "todos" });
      return;
    }
    // Ao entrar em A pagar/A receber, o padrão é o que está em aberto.
    setFilters({ ...filters, tipo: v, status: filters.status === "todos" ? "pendentes" : filters.status });
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

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <ViewSwitcher options={VISOES} value={visao} onChange={trocarVisao} ariaLabel="O que ver" />
          <p className="text-sm text-muted-foreground">
            Vendo <span className="font-medium text-foreground">{recorteLabel(filters)}</span> · por vencimento
          </p>
          <DataFrescor
            updatedAt={resumoUpdatedAt}
            isFetching={fetchingResumo}
            onRefresh={() => void refetchResumo()}
            className="mt-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-9 rounded-full gap-1" onClick={() => setImportar(true)}>
            <Upload className="h-3.5 w-3.5" />
            Importar
          </Button>
        </div>
      </div>

      {tipoTitulos && (
        <PosicaoChips
          tipo={tipoTitulos}
          posicao={posicao.data}
          loading={posicao.isLoading}
          ativo={ativo}
          onSelect={(b) => posicao.data && setFilters(filtroDoBalde(b, posicao.data.hoje, filters))}
        />
      )}

      {/* KPIs clicáveis (visão Tudo): cada um aplica o filtro correspondente. */}
      {/* Colunas pela largura real (container), não pela tela: com as duas sidebars,
          1024px de tela deixam ~480px aqui, e 4 cards cortavam o valor. */}
      {tipoTitulos ? null : erroResumo ? (
        <FinanceErrorState onRetry={() => void refetchResumo()} />
      ) : (
        <div className="@container">
          <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
            <KPICard
              label="Recebido"
              value={resumo.recebido}
              icon={TrendingUp}
              tone="positive"
              loading={loadingResumo}
              onClick={() => patchFilters({ tipo: "receita", status: "pagos" })}
            />
            <KPICard
              label="Pago"
              value={resumo.pago}
              icon={TrendingDown}
              tone="danger"
              loading={loadingResumo}
              onClick={() => patchFilters({ tipo: "despesa", status: "pagos" })}
            />
            <KPICard
              label="A receber"
              value={resumo.aReceber}
              icon={Clock}
              tone="info"
              loading={loadingResumo}
              onClick={() => patchFilters({ tipo: "receita", status: "pendentes" })}
            />
            <KPICard
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
      )}

      <Card className="rounded-2xl border border-black/5 bg-white p-4 max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:shadow-none">
        <CardContent className="p-0">
          <LancamentosTable resumo={resumo} filters={filters} onFiltersChange={setFilters} onMutated={invalidate} />

          <ImportarLancamentosDialog open={importar} onOpenChange={setImportar} onImported={invalidate} />
        </CardContent>
      </Card>
    </div>
  );
}

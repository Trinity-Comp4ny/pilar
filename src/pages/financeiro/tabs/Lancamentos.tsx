import { useCallback, useMemo, useState } from "react";
import { KPICard } from "@/components/KPICard";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, Clock, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LancamentosTable } from "../components/LancamentosTable";
import { useLancamentosPaginados } from "../hooks/useLancamentosPaginados";
import { LancamentoFormDialog } from "../components/LancamentoFormDialog";
import { TransferenciaFormDialog } from "../components/TransferenciaFormDialog";
import {
  periodoRange,
  readFiltersFromParams,
  writeFiltersToParams,
  type LancamentosFilters,
} from "../components/lancamentosFilters";
import type { TipoLancamento } from "../hooks/useLancamentosUnified";

interface KPIs {
  recebido: number;
  pago: number;
  aReceber: number;
  aPagar: number;
}

const EMPTY_KPIS: KPIs = { recebido: 0, pago: 0, aReceber: 0, aPagar: 0 };

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

  const [newTipo, setNewTipo] = useState<TipoLancamento | null>(null);
  const [newTransferencia, setNewTransferencia] = useState(false);

  const range = useMemo(() => periodoRange(filters), [filters]);
  const paginated = useLancamentosPaginados({ from: range.from, to: range.to });
  const items = paginated.data;

  const queryClient = useQueryClient();
  const invalidateKpis = () => queryClient.invalidateQueries({ queryKey: ["lancamentos-kpis"] });

  const { data: kpisRaw, isLoading: loadingKpis } = useQuery({
    queryKey: ["lancamentos-kpis", range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_lancamentos_kpis", {
        p_from: range.from ?? undefined,
        p_to: range.to ?? undefined,
      });
      if (error) throw error;
      return data as { recebido: number; a_receber: number; pago: number; a_pagar: number };
    },
    staleTime: 30_000,
  });

  const kpis: KPIs = kpisRaw
    ? {
        recebido: Number(kpisRaw.recebido),
        pago: Number(kpisRaw.pago),
        aReceber: Number(kpisRaw.a_receber),
        aPagar: Number(kpisRaw.a_pagar),
      }
    : EMPTY_KPIS;

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Lançamentos</h2>
          <p className="text-sm text-muted-foreground">Receitas e despesas em um só lugar</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-9 rounded-full gap-1 border-positive text-positive-strong hover:bg-positive/10"
            onClick={() => setNewTipo("receita")}
          >
            <Plus className="h-3.5 w-3.5" />
            Nova receita
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 rounded-full gap-1 border-danger-mid text-danger-mid hover:bg-danger-soft"
            onClick={() => setNewTipo("despesa")}
          >
            <Plus className="h-3.5 w-3.5" />
            Nova despesa
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 rounded-full gap-1 border-info-mid text-info-mid hover:bg-info-soft"
            onClick={() => setNewTransferencia(true)}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Transferência
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard label="Recebido" value={kpis.recebido} icon={TrendingUp} tone="positive" loading={loadingKpis} />
        <KPICard label="Pago" value={kpis.pago} icon={TrendingDown} tone="danger" loading={loadingKpis} />
        <KPICard label="A receber" value={kpis.aReceber} icon={Clock} tone="info" loading={loadingKpis} />
        <KPICard label="A pagar" value={kpis.aPagar} icon={Clock} tone="warning" loading={loadingKpis} />
      </div>

      <Card className="rounded-2xl border border-black/5 bg-white p-4">
        <CardContent className="p-0">


          <LancamentosTable
            data={items}
            loading={paginated.isLoading}
            onRefetch={() => paginated.refetch()}
            filters={filters}
            onFiltersChange={setFilters}
            hasNextPage={paginated.hasNextPage}
            isFetchingNextPage={paginated.isFetchingNextPage}
            onLoadMore={() => paginated.fetchNextPage()}
          />

          {newTipo && (
            <LancamentoFormDialog
              open
              onOpenChange={(v) => !v && setNewTipo(null)}
              tipo={newTipo}
              onSaved={() => {
                setNewTipo(null);
                paginated.refetch();
                invalidateKpis();
              }}
            />
          )}

          <TransferenciaFormDialog
            open={newTransferencia}
            onOpenChange={setNewTransferencia}
            onSaved={() => {
              setNewTransferencia(false);
              paginated.refetch();
              invalidateKpis();
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}


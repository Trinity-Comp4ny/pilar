import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, Clock, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { LancamentosTable } from "../components/LancamentosTable";
import { useLancamentosPaginados } from "../hooks/useLancamentosPaginados";
import { LancamentoFormDialog } from "../components/LancamentoFormDialog";
import { TransferenciaFormDialog } from "../components/TransferenciaFormDialog";
import { defaultFilters, periodoRange, type LancamentosFilters } from "../components/lancamentosFilters";
import type { TipoLancamento } from "../hooks/useLancamentosUnified";

interface KPIs {
  recebido: number;
  pago: number;
  aReceber: number;
  aPagar: number;
}

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const EMPTY_KPIS: KPIs = { recebido: 0, pago: 0, aReceber: 0, aPagar: 0 };

export default function Lancamentos() {
  const [filters, setFilters] = useState<LancamentosFilters>(defaultFilters);
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
            className="h-9 rounded-full gap-1 border-red-400 text-red-600 hover:bg-red-50"
            onClick={() => setNewTipo("despesa")}
          >
            <Plus className="h-3.5 w-3.5" />
            Nova despesa
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 rounded-full gap-1 border-blue-400 text-blue-600 hover:bg-blue-50"
            onClick={() => setNewTransferencia(true)}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Transferência
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard label="Recebido" value={kpis.recebido} icon={TrendingUp} tone="positive" loading={loadingKpis} />
        <KPICard label="Pago" value={kpis.pago} icon={TrendingDown} tone="negative" loading={loadingKpis} />
        <KPICard label="A receber" value={kpis.aReceber} icon={Clock} tone="neutral-positive" loading={loadingKpis} />
        <KPICard label="A pagar" value={kpis.aPagar} icon={Clock} tone="neutral-negative" loading={loadingKpis} />
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

interface KPICardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "positive" | "negative" | "neutral-positive" | "neutral-negative";
  loading: boolean;
}

function KPICard({ label, value, icon: Icon, tone, loading }: KPICardProps) {
  const toneClass = {
    positive: "text-positive-strong bg-positive/10",
    negative: "text-red-600 bg-red-50",
    "neutral-positive": "text-emerald-700 bg-emerald-50",
    "neutral-negative": "text-amber-700 bg-amber-50",
  }[tone];

  return (
    <Card className="rounded-2xl border border-black/5 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-lg font-bold mt-1 whitespace-nowrap">
            {loading ? <span className="inline-block h-6 w-24 bg-muted rounded animate-pulse" /> : formatBRL(value)}
          </p>
        </div>
        <span className={cn("rounded-full p-2 flex-shrink-0", toneClass)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </Card>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, Clock, Plus, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { LancamentosTable } from "../components/LancamentosTable";
import { useLancamentosUnified } from "../hooks/useLancamentosUnified";
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

export default function Lancamentos() {
  const [filters, setFilters] = useState<LancamentosFilters>(defaultFilters);
  const [newTipo, setNewTipo] = useState<TipoLancamento | null>(null);
  const [newTransferencia, setNewTransferencia] = useState(false);
  const [kpis, setKpis] = useState<KPIs>({ recebido: 0, pago: 0, aReceber: 0, aPagar: 0 });
  const [loadingKpis, setLoadingKpis] = useState(false);

  const range = useMemo(() => periodoRange(filters), [filters]);
  const unified = useLancamentosUnified({ from: range.from, to: range.to });

  useEffect(() => {
    const fetchKpis = async () => {
      setLoadingKpis(true);
      try {
        let receitasQuery = supabase.from("receitas").select("valor, status, data_vencimento").is("deleted_at", null);
        let despesasQuery = supabase.from("despesas").select("valor, status, data_vencimento").is("deleted_at", null);

        if (range.from) {
          receitasQuery = receitasQuery.gte("data_vencimento", range.from);
          despesasQuery = despesasQuery.gte("data_vencimento", range.from);
        }
        if (range.to) {
          receitasQuery = receitasQuery.lte("data_vencimento", range.to);
          despesasQuery = despesasQuery.lte("data_vencimento", range.to);
        }

        const [{ data: rec }, { data: desp }] = await Promise.all([receitasQuery, despesasQuery]);

        const recebido = (rec ?? [])
          .filter((r) => r.status === "Recebido")
          .reduce((s, r) => s + Number(r.valor || 0), 0);
        const aReceber = (rec ?? [])
          .filter((r) => r.status !== "Recebido")
          .reduce((s, r) => s + Number(r.valor || 0), 0);
        const pago = (desp ?? []).filter((d) => d.status === "Pago").reduce((s, d) => s + Number(d.valor || 0), 0);
        const aPagar = (desp ?? []).filter((d) => d.status !== "Pago").reduce((s, d) => s + Number(d.valor || 0), 0);

        setKpis({ recebido, pago, aReceber, aPagar });
      } finally {
        setLoadingKpis(false);
      }
    };
    fetchKpis();
  }, [range.from, range.to]);

  const saldo = kpis.recebido - kpis.pago;

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Lançamentos</h1>
          <p className="text-sm text-muted-foreground">Receitas e despesas em um só lugar</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-9 rounded-full gap-1 border-positive text-positive hover:bg-positive/10"
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

      <Card className="rounded-2xl border-black/10 p-4">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-end gap-2 mb-3">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Saldo no período:{" "}
              <span className={cn("font-semibold", saldo >= 0 ? "text-positive" : "text-red-600")}>
                {formatBRL(saldo)}
              </span>
            </div>
          </div>

          <LancamentosTable
            data={unified.data}
            loading={unified.loading}
            onRefetch={unified.refetch}
            filters={filters}
            onFiltersChange={setFilters}
          />

          {newTipo && (
            <LancamentoFormDialog
              open={newTipo !== null}
              onOpenChange={(v) => !v && setNewTipo(null)}
              tipo={newTipo}
              onSaved={() => {
                setNewTipo(null);
                unified.refetch();
              }}
            />
          )}

          <TransferenciaFormDialog
            open={newTransferencia}
            onOpenChange={setNewTransferencia}
            onSaved={() => {
              setNewTransferencia(false);
              unified.refetch();
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
    positive: "text-positive bg-positive/10",
    negative: "text-red-600 bg-red-50",
    "neutral-positive": "text-emerald-700 bg-emerald-50",
    "neutral-negative": "text-amber-700 bg-amber-50",
  }[tone];

  return (
    <Card className="rounded-2xl border-black/10 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-xl font-bold mt-1 truncate">
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

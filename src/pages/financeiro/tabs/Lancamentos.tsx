import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownCircle, ArrowUpCircle, TrendingUp, TrendingDown, Wallet, Clock } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import Receitas from "./Receitas";
import Despesas from "./Despesas";

type Tipo = "receitas" | "despesas";
type Periodo = "mes-atual" | "mes-anterior" | "ultimos-30" | "ano" | "tudo";

const PERIODO_LABEL: Record<Periodo, string> = {
  "mes-atual": "Mês atual",
  "mes-anterior": "Mês anterior",
  "ultimos-30": "Últimos 30 dias",
  ano: "Este ano",
  tudo: "Todo período",
};

const periodoRange = (p: Periodo): { from: string | null; to: string | null } => {
  const today = new Date();
  if (p === "tudo") return { from: null, to: null };
  if (p === "mes-atual")
    return { from: format(startOfMonth(today), "yyyy-MM-dd"), to: format(endOfMonth(today), "yyyy-MM-dd") };
  if (p === "mes-anterior") {
    const prev = subMonths(today, 1);
    return { from: format(startOfMonth(prev), "yyyy-MM-dd"), to: format(endOfMonth(prev), "yyyy-MM-dd") };
  }
  if (p === "ultimos-30") {
    const from = new Date(today);
    from.setDate(from.getDate() - 30);
    return { from: format(from, "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") };
  }
  return { from: format(startOfYear(today), "yyyy-MM-dd"), to: format(endOfYear(today), "yyyy-MM-dd") };
};

interface KPIs {
  recebido: number;
  pago: number;
  aReceber: number;
  aPagar: number;
}

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export default function Lancamentos() {
  const [tipo, setTipo] = useState<Tipo>("receitas");
  const [periodo, setPeriodo] = useState<Periodo>("mes-atual");
  const [kpis, setKpis] = useState<KPIs>({ recebido: 0, pago: 0, aReceber: 0, aPagar: 0 });
  const [loadingKpis, setLoadingKpis] = useState(false);

  const range = useMemo(() => periodoRange(periodo), [periodo]);

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
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
          <SelectTrigger className="h-9 w-[180px] rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PERIODO_LABEL).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard label="Recebido" value={kpis.recebido} icon={TrendingUp} tone="positive" loading={loadingKpis} />
        <KPICard label="Pago" value={kpis.pago} icon={TrendingDown} tone="negative" loading={loadingKpis} />
        <KPICard label="A receber" value={kpis.aReceber} icon={Clock} tone="neutral-positive" loading={loadingKpis} />
        <KPICard label="A pagar" value={kpis.aPagar} icon={Clock} tone="neutral-negative" loading={loadingKpis} />
      </div>

      <Card className="rounded-2xl border-black/10 p-4">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="inline-flex rounded-full bg-muted p-1">
              <SegBtn active={tipo === "receitas"} onClick={() => setTipo("receitas")}>
                <ArrowUpCircle className="h-4 w-4" />
                Receitas
              </SegBtn>
              <SegBtn active={tipo === "despesas"} onClick={() => setTipo("despesas")}>
                <ArrowDownCircle className="h-4 w-4" />
                Despesas
              </SegBtn>
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Saldo do período:{" "}
              <span className={cn("font-semibold", saldo >= 0 ? "text-positive" : "text-red-600")}>
                {formatBRL(saldo)}
              </span>
            </div>
          </div>

          {tipo === "receitas" ? <Receitas /> : <Despesas />}
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

function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        "rounded-full h-8 px-4 gap-2 text-sm transition-colors",
        active ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </Button>
  );
}

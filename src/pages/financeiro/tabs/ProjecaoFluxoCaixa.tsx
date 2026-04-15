import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface ProjecaoItem {
  data: string;
  label: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

export default function ProjecaoFluxoCaixa() {
  const [dias] = useState(90);

  const { data: saldoAtual = 0, isLoading: loadingSaldo } = useQuery({
    queryKey: ["saldo-atual-total"],
    queryFn: async () => {
      const { data, error } = await supabase.from("view_financas_resumo").select("saldo_atual");
      if (error) throw error;
      return (data || []).reduce((sum: number, row) => sum + (Number(row.saldo_atual) || 0), 0);
    },
    staleTime: 1000 * 60 * 3,
  });

  const { data: receitasFuturas = [], isLoading: loadingReceitas } = useQuery({
    queryKey: ["receitas-futuras", dias],
    queryFn: async () => {
      const hoje = new Date().toISOString().split("T")[0];
      const futuro = new Date(Date.now() + dias * 86400000).toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("receitas")
        .select("valor, data_vencimento, status")
        .gte("data_vencimento", hoje)
        .lte("data_vencimento", futuro)
        .in("status", ["Pendente", "Atrasado"])
        .is("deleted_at", null);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 3,
  });

  const { data: despesasFuturas = [], isLoading: loadingDespesas } = useQuery({
    queryKey: ["despesas-futuras", dias],
    queryFn: async () => {
      const hoje = new Date().toISOString().split("T")[0];
      const futuro = new Date(Date.now() + dias * 86400000).toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("despesas")
        .select("valor, data_vencimento, status")
        .gte("data_vencimento", hoje)
        .lte("data_vencimento", futuro)
        .in("status", ["Pendente", "Atrasado"])
        .is("deleted_at", null);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 3,
  });

  const projecao = useMemo(() => {
    if (loadingSaldo || loadingReceitas || loadingDespesas) return [];

    // Agrupar por semana
    const semanas: Map<string, { entradas: number; saidas: number }> = new Map();
    const hoje = new Date();

    for (let i = 0; i < dias; i += 7) {
      const weekStart = new Date(hoje.getTime() + i * 86400000);
      const key = weekStart.toISOString().split("T")[0];
      semanas.set(key, { entradas: 0, saidas: 0 });
    }

    const getWeekKey = (dateStr: string) => {
      const date = new Date(dateStr + "T00:00:00");
      const diffDays = Math.floor((date.getTime() - hoje.getTime()) / 86400000);
      const weekIndex = Math.max(0, Math.floor(diffDays / 7));
      const keys = Array.from(semanas.keys());
      return keys[Math.min(weekIndex, keys.length - 1)] || keys[0];
    };

    for (const r of receitasFuturas) {
      const weekKey = getWeekKey(r.data_vencimento);
      const week = semanas.get(weekKey);
      if (week) week.entradas += Number(r.valor) || 0;
    }

    for (const d of despesasFuturas) {
      const weekKey = getWeekKey(d.data_vencimento);
      const week = semanas.get(weekKey);
      if (week) week.saidas += Number(d.valor) || 0;
    }

    let saldoAcumulado = saldoAtual;
    const result: ProjecaoItem[] = [];

    for (const [data, { entradas, saidas }] of semanas) {
      saldoAcumulado += entradas - saidas;
      const date = new Date(data + "T00:00:00");
      result.push({
        data,
        label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        entradas,
        saidas,
        saldo: saldoAcumulado,
      });
    }

    return result;
  }, [saldoAtual, receitasFuturas, despesasFuturas, dias, loadingSaldo, loadingReceitas, loadingDespesas]);

  const isLoading = loadingSaldo || loadingReceitas || loadingDespesas;

  const totalEntradas = projecao.reduce((s, p) => s + p.entradas, 0);
  const totalSaidas = projecao.reduce((s, p) => s + p.saidas, 0);
  const saldoFinal = projecao.length > 0 ? projecao[projecao.length - 1].saldo : saldoAtual;
  const ficaNegativo = projecao.some((p) => p.saldo < 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Saldo Atual</p>
            <p className={`text-xl font-bold ${saldoAtual >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {formatCurrency(saldoAtual)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" /> A Receber ({dias}d)
            </p>
            <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalEntradas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-red-500" /> A Pagar ({dias}d)
            </p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(totalSaidas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Saldo em {dias} dias</p>
            <p className={`text-xl font-bold ${saldoFinal >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {formatCurrency(saldoFinal)}
            </p>
            {ficaNegativo && (
              <Badge variant="destructive" className="mt-1 text-[10px]">
                <AlertTriangle className="h-3 w-3 mr-1" /> Caixa negativo previsto
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Projeção de Caixa — Próximos {dias} dias</CardTitle>
        </CardHeader>
        <CardContent>
          {projecao.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma receita ou despesa futura cadastrada.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={projecao} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradientSaldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === "saldo" ? "Saldo Projetado" : name === "entradas" ? "Entradas" : "Saídas",
                  ]}
                  labelStyle={{ fontWeight: 600 }}
                />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="5 5" strokeWidth={1.5} />
                <Area type="monotone" dataKey="saldo" stroke="#10b981" fill="url(#gradientSaldo)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Tabela semanal */}
      {projecao.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Detalhamento Semanal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-3 font-medium">Semana</th>
                    <th className="text-right py-2 px-3 font-medium">Entradas</th>
                    <th className="text-right py-2 px-3 font-medium">Saídas</th>
                    <th className="text-right py-2 px-3 font-medium">Saldo Projetado</th>
                  </tr>
                </thead>
                <tbody>
                  {projecao.map((p) => (
                    <tr key={p.data} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3 font-medium">{p.label}</td>
                      <td className="py-2 px-3 text-right text-emerald-600">
                        {p.entradas > 0 ? `+${formatCurrency(p.entradas)}` : "—"}
                      </td>
                      <td className="py-2 px-3 text-right text-red-600">
                        {p.saidas > 0 ? `-${formatCurrency(p.saidas)}` : "—"}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-medium ${p.saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {formatCurrency(p.saldo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

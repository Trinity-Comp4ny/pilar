import { useMemo } from "react";
import { formatCurrency as fmtMoeda } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, AlertTriangle, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const formatCurrency = (v: number) => fmtMoeda(v, { decimals: 0 });

interface AgingBucket {
  cliente_id: string;
  cliente_nome: string;
  bucket_0_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
  total: number;
}

export default function AgingRecebiveis() {
  const { data: receitas = [], isLoading } = useQuery({
    queryKey: ["aging-recebiveis-raw"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receitas")
        .select("id, valor, data_vencimento, status, cliente_id, clientes(nome)")
        .in("status", ["Pendente", "Atrasado"])
        .is("deleted_at", null)
        .order("data_vencimento");
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 3,
  });

  const aging = useMemo(() => {
    const hoje = new Date();
    const clienteMap = new Map<string, AgingBucket>();

    for (const r of receitas) {
      const clienteId = r.cliente_id || "sem-cliente";
      const clienteNome = (r as { clientes?: { nome?: string } | null }).clientes?.nome || "Sem cliente";
      const vencimento = new Date(r.data_vencimento + "T00:00:00");
      const diasAtraso = Math.max(0, Math.floor((hoje.getTime() - vencimento.getTime()) / 86400000));
      const valor = Number(r.valor) || 0;

      if (!clienteMap.has(clienteId)) {
        clienteMap.set(clienteId, {
          cliente_id: clienteId,
          cliente_nome: clienteNome,
          bucket_0_30: 0,
          bucket_31_60: 0,
          bucket_61_90: 0,
          bucket_90_plus: 0,
          total: 0,
        });
      }

      const bucket = clienteMap.get(clienteId)!;
      bucket.total += valor;

      if (diasAtraso <= 30) bucket.bucket_0_30 += valor;
      else if (diasAtraso <= 60) bucket.bucket_31_60 += valor;
      else if (diasAtraso <= 90) bucket.bucket_61_90 += valor;
      else bucket.bucket_90_plus += valor;
    }

    return Array.from(clienteMap.values()).sort((a, b) => b.total - a.total);
  }, [receitas]);

  const totalGeral = aging.reduce((s, a) => s + a.total, 0);
  const total90Plus = aging.reduce((s, a) => s + a.bucket_90_plus, 0);
  const totalAtrasado = aging.reduce((s, a) => s + a.bucket_31_60 + a.bucket_61_90 + a.bucket_90_plus, 0);
  const prazoMedio =
    receitas.length > 0
      ? receitas.reduce((s, r) => {
          const venc = new Date(r.data_vencimento + "T00:00:00");
          return s + Math.max(0, Math.floor((Date.now() - venc.getTime()) / 86400000));
        }, 0) / receitas.length
      : 0;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const chartData = aging.slice(0, 10).map((a) => ({
    nome: a.cliente_nome.substring(0, 15),
    "0-30d": a.bucket_0_30,
    "31-60d": a.bucket_31_60,
    "61-90d": a.bucket_61_90,
    "90+d": a.bucket_90_plus,
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total em Aberto</p>
            <p className="text-xl font-bold">{formatCurrency(totalGeral)}</p>
            <p className="text-xs text-muted-foreground">{receitas.length} título(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Atrasado (&gt;30d)</p>
            <p className="text-xl font-bold text-amber-600">{formatCurrency(totalAtrasado)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-red-500" /> Crítico (&gt;90d)
            </p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(total90Plus)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Prazo Médio Atraso
            </p>
            <p className="text-xl font-bold">{prazoMedio.toFixed(0)} dias</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico stacked bar */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Aging por Cliente (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={11} />
                <YAxis type="category" dataKey="nome" width={100} fontSize={10} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend fontSize={11} />
                <Bar dataKey="0-30d" stackId="aging" fill="hsl(var(--chart-success))" name="0-30 dias" />
                <Bar dataKey="31-60d" stackId="aging" fill="hsl(var(--chart-warning-alt))" name="31-60 dias" />
                <Bar dataKey="61-90d" stackId="aging" fill="hsl(var(--c-orange-500))" name="61-90 dias" />
                <Bar dataKey="90+d" stackId="aging" fill="hsl(var(--chart-danger))" name="90+ dias" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Tabela detalhada */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detalhamento por Cliente ({aging.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {aging.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum recebível em aberto.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Cliente</TableHead>
                    <TableHead className="text-xs text-right">0-30 dias</TableHead>
                    <TableHead className="text-xs text-right">31-60 dias</TableHead>
                    <TableHead className="text-xs text-right">61-90 dias</TableHead>
                    <TableHead className="text-xs text-right">90+ dias</TableHead>
                    <TableHead className="text-xs text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aging.map((a) => (
                    <TableRow key={a.cliente_id}>
                      <TableCell className="text-xs py-2 font-medium">{a.cliente_nome}</TableCell>
                      <TableCell className="text-xs py-2 text-right text-emerald-600">
                        {a.bucket_0_30 > 0 ? formatCurrency(a.bucket_0_30) : "—"}
                      </TableCell>
                      <TableCell className="text-xs py-2 text-right text-amber-600">
                        {a.bucket_31_60 > 0 ? formatCurrency(a.bucket_31_60) : "—"}
                      </TableCell>
                      <TableCell className="text-xs py-2 text-right text-orange-600">
                        {a.bucket_61_90 > 0 ? formatCurrency(a.bucket_61_90) : "—"}
                      </TableCell>
                      <TableCell className="text-xs py-2 text-right text-red-600 font-semibold">
                        {a.bucket_90_plus > 0 ? formatCurrency(a.bucket_90_plus) : "—"}
                      </TableCell>
                      <TableCell className="text-xs py-2 text-right font-bold">{formatCurrency(a.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

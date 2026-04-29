import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

interface WipSnapshot {
  id: string;
  projeto_id: string;
  mes: number;
  ano: number;
  horas_realizadas: number;
  custo_realizado: number;
  faturado: number;
  recebido: number;
  wip_saldo: number;
  projetos: { nome: string; codigo_projeto: string } | null;
}

export default function WIP() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());

  const { data: snapshots = [], isLoading } = useQuery<WipSnapshot[]>({
    queryKey: ["wip-snapshots", mes, ano],
    queryFn: async () => {
      // Módulo WIP dormente — tabela wip_snapshots removida
      return [] as WipSnapshot[];
    },
    staleTime: 1000 * 60 * 3,
  });

  const calcularMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("rpc_calcular_wip", { p_mes: mes, p_ano: ano });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["wip-snapshots"] });
      toast.success(`WIP calculado para ${count} projeto(s)`);
    },
    onError: () => toast.error("Erro"),
  });

  const totalCusto = snapshots.reduce((s, w) => s + (Number(w.custo_realizado) || 0), 0);
  const totalFaturado = snapshots.reduce((s, w) => s + (Number(w.faturado) || 0), 0);
  const totalRecebido = snapshots.reduce((s, w) => s + (Number(w.recebido) || 0), 0);
  const totalWIP = totalCusto - totalFaturado;
  const wipPositivo = snapshots.filter((w) => Number(w.wip_saldo) > 0).length;
  const wipNegativo = snapshots.filter((w) => Number(w.wip_saldo) < 0).length;

  const meses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  return (
    <div className="space-y-6">
      {/* Controles */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {meses.map((m, i) => (
              <SelectItem key={i} value={String(i + 1)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[ano - 1, ano, ano + 1].map((a) => (
              <SelectItem key={a} value={String(a)}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => calcularMutation.mutate()}
          disabled={calcularMutation.isPending}
        >
          {calcularMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
          )}
          Calcular WIP
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Custo Realizado</p>
            <p className="text-lg font-bold">{formatCurrency(totalCusto)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Faturado</p>
            <p className="text-lg font-bold text-blue-600">{formatCurrency(totalFaturado)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Recebido</p>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalRecebido)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Saldo WIP Total</p>
            <p className={`text-lg font-bold ${totalWIP > 0 ? "text-amber-600" : totalWIP < 0 ? "text-blue-600" : ""}`}>
              {formatCurrency(totalWIP)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Projetos</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge className="bg-amber-100 text-amber-800 text-[10px]">
                <TrendingUp className="h-3 w-3 mr-0.5" /> {wipPositivo} subfaturados
              </Badge>
              <Badge className="bg-blue-100 text-blue-800 text-[10px]">
                <TrendingDown className="h-3 w-3 mr-0.5" /> {wipNegativo} sobrefaturados
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            WIP — {meses[mes - 1]} {ano}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : snapshots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Nenhum snapshot WIP para este período.</p>
              <p className="text-xs mt-1">Clique em "Calcular WIP" para gerar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Projeto</TableHead>
                    <TableHead className="text-xs text-right">Horas</TableHead>
                    <TableHead className="text-xs text-right">Custo Realizado</TableHead>
                    <TableHead className="text-xs text-center">
                      <ArrowRight className="h-3 w-3 mx-auto" />
                    </TableHead>
                    <TableHead className="text-xs text-right">Faturado</TableHead>
                    <TableHead className="text-xs text-center">
                      <ArrowRight className="h-3 w-3 mx-auto" />
                    </TableHead>
                    <TableHead className="text-xs text-right">Recebido</TableHead>
                    <TableHead className="text-xs text-right">Saldo WIP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshots.map((w) => {
                    const wipSaldo = Number(w.wip_saldo) || 0;
                    return (
                      <TableRow key={w.id}>
                        <TableCell className="text-xs py-2">
                          <span className="font-medium">{w.projetos?.codigo_projeto || "—"}</span>
                          <span className="text-muted-foreground ml-1">- {w.projetos?.nome || "—"}</span>
                        </TableCell>
                        <TableCell className="text-xs py-2 text-right">
                          {Number(w.horas_realizadas).toFixed(0)}h
                        </TableCell>
                        <TableCell className="text-xs py-2 text-right">
                          {formatCurrency(Number(w.custo_realizado))}
                        </TableCell>
                        <TableCell className="text-xs py-2 text-center text-muted-foreground">→</TableCell>
                        <TableCell className="text-xs py-2 text-right text-blue-600">
                          {formatCurrency(Number(w.faturado))}
                        </TableCell>
                        <TableCell className="text-xs py-2 text-center text-muted-foreground">→</TableCell>
                        <TableCell className="text-xs py-2 text-right text-emerald-600">
                          {formatCurrency(Number(w.recebido))}
                        </TableCell>
                        <TableCell
                          className={`text-xs py-2 text-right font-semibold ${wipSaldo > 0 ? "text-amber-600" : wipSaldo < 0 ? "text-blue-600" : ""}`}
                        >
                          {formatCurrency(wipSaldo)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Explicação */}
      <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-4 space-y-1">
        <p>
          <strong>WIP positivo (subfaturado):</strong> Trabalho realizado mas ainda não faturado ao cliente. Indica
          serviço prestado sem cobrança.
        </p>
        <p>
          <strong>WIP negativo (sobrefaturado):</strong> Faturado mais do que o trabalho realizado. Pode indicar
          adiantamento ou risco de entrega.
        </p>
      </div>
    </div>
  );
}

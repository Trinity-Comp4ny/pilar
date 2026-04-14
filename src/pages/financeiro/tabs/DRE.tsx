import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

interface DRELine {
  label: string;
  value: number;
  prevValue: number;
  isTotal?: boolean;
  isSubtraction?: boolean;
  indent?: boolean;
}

export default function DRE() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());

  const prevMes = mes === 1 ? 12 : mes - 1;
  const prevAno = mes === 1 ? ano - 1 : ano;

  const fetchPeriodo = async (m: number, a: number) => {
    const inicio = `${a}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(a, m, 0).getDate();
    const fim = `${a}-${String(m).padStart(2, "0")}-${lastDay}`;

    const [receitasRes, despesasRes, folhaRes] = await Promise.all([
      supabase
        .from("receitas")
        .select("valor, projeto_id, status")
        .gte("data_vencimento", inicio)
        .lte("data_vencimento", fim)
        .eq("status", "Recebido")
        .is("deleted_at", null),
      supabase
        .from("despesas")
        .select("valor, projeto_id, status")
        .gte("data_vencimento", inicio)
        .lte("data_vencimento", fim)
        .eq("status", "Pago")
        .is("deleted_at", null),
      supabase
        .from("folha_pagamento")
        .select("total_receber")
        .eq("mes", m)
        .eq("ano", a),
    ]);

    const receitas = receitasRes.data || [];
    const despesas = despesasRes.data || [];
    const folha = folhaRes.data || [];

    const receitaBruta = receitas.reduce((s, r) => s + (Number(r.valor) || 0), 0);
    const custosDiretos = despesas
      .filter((d) => d.projeto_id)
      .reduce((s, d) => s + (Number(d.valor) || 0), 0);
    const custosIndiretos = despesas
      .filter((d) => !d.projeto_id)
      .reduce((s, d) => s + (Number(d.valor) || 0), 0);
    const folhaTotal = folha.reduce((s, f) => s + (Number(f.total_receber) || 0), 0);

    const margemBruta = receitaBruta - custosDiretos;
    const resultadoOperacional = margemBruta - custosIndiretos - folhaTotal;

    return {
      receitaBruta,
      custosDiretos,
      margemBruta,
      custosIndiretos,
      folhaTotal,
      resultadoOperacional,
    };
  };

  const { data, isLoading } = useQuery({
    queryKey: ["dre", mes, ano],
    queryFn: async () => {
      const [atual, anterior] = await Promise.all([
        fetchPeriodo(mes, ano),
        fetchPeriodo(prevMes, prevAno),
      ]);
      return { atual, anterior };
    },
    staleTime: 1000 * 60 * 3,
  });

  const lines: DRELine[] = useMemo(() => {
    if (!data) return [];
    const { atual, anterior } = data;
    return [
      { label: "(+) Receita Bruta", value: atual.receitaBruta, prevValue: anterior.receitaBruta },
      { label: "(-) Custos Diretos de Projetos", value: -atual.custosDiretos, prevValue: -anterior.custosDiretos, isSubtraction: true, indent: true },
      { label: "(=) Margem Bruta", value: atual.margemBruta, prevValue: anterior.margemBruta, isTotal: true },
      { label: "(-) Custos Indiretos (sem projeto)", value: -atual.custosIndiretos, prevValue: -anterior.custosIndiretos, isSubtraction: true, indent: true },
      { label: "(-) Folha de Pagamento", value: -atual.folhaTotal, prevValue: -anterior.folhaTotal, isSubtraction: true, indent: true },
      { label: "(=) Resultado Operacional", value: atual.resultadoOperacional, prevValue: anterior.resultadoOperacional, isTotal: true },
    ];
  }, [data]);

  const meses = [
    { value: 1, label: "Janeiro" }, { value: 2, label: "Fevereiro" }, { value: 3, label: "Março" },
    { value: 4, label: "Abril" }, { value: 5, label: "Maio" }, { value: 6, label: "Junho" },
    { value: 7, label: "Julho" }, { value: 8, label: "Agosto" }, { value: 9, label: "Setembro" },
    { value: 10, label: "Outubro" }, { value: 11, label: "Novembro" }, { value: 12, label: "Dezembro" },
  ];

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Seletor de período */}
      <div className="flex items-center gap-3">
        <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {meses.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
          <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[ano - 1, ano, ano + 1].map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* DRE */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Demonstração de Resultado — {meses[mes - 1].label} {ano}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Comparação com {meses[prevMes - 1].label} {prevAno}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {/* Header */}
            <div className="grid grid-cols-4 gap-4 pb-2 border-b text-xs font-medium text-muted-foreground">
              <div className="col-span-1">Conta</div>
              <div className="text-right">{meses[mes - 1].label.substring(0, 3)}/{ano}</div>
              <div className="text-right">{meses[prevMes - 1].label.substring(0, 3)}/{prevAno}</div>
              <div className="text-right">Variação</div>
            </div>

            {lines.map((line, i) => {
              const delta = line.prevValue !== 0
                ? ((line.value - line.prevValue) / Math.abs(line.prevValue)) * 100
                : line.value !== 0 ? 100 : 0;

              return (
                <div
                  key={i}
                  className={`grid grid-cols-4 gap-4 py-2 text-sm ${
                    line.isTotal ? "border-t border-b font-bold bg-muted/30" : ""
                  } ${line.indent ? "pl-4" : ""}`}
                >
                  <div className={`col-span-1 ${line.isSubtraction ? "text-muted-foreground" : ""}`}>
                    {line.label}
                  </div>
                  <div className={`text-right ${line.value >= 0 ? "" : "text-red-600"}`}>
                    {formatCurrency(Math.abs(line.value))}
                  </div>
                  <div className={`text-right text-muted-foreground ${line.prevValue >= 0 ? "" : "text-red-400"}`}>
                    {formatCurrency(Math.abs(line.prevValue))}
                  </div>
                  <div className={`text-right text-xs flex items-center justify-end gap-1 ${
                    delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-muted-foreground"
                  }`}>
                    {delta > 0 ? <TrendingUp className="h-3 w-3" /> : delta < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                    {formatPct(delta)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Margem % */}
          {data && data.atual.receitaBruta > 0 && (
            <div className="mt-4 pt-4 border-t flex gap-8 text-sm">
              <div>
                <span className="text-muted-foreground">Margem Bruta: </span>
                <span className="font-semibold">
                  {((data.atual.margemBruta / data.atual.receitaBruta) * 100).toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Margem Operacional: </span>
                <span className={`font-semibold ${data.atual.resultadoOperacional >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {((data.atual.resultadoOperacional / data.atual.receitaBruta) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

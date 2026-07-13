// Cache policy: dados financeiros (saldo/receitas/despesas) precisam estar fresh.
// staleTime 2min + refetchInterval 5min + refetchOnWindowFocus garantem que o
// usuário sempre veja números próximos da realidade ao voltar pra aba.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subMonths, startOfMonth, endOfMonth } from "date-fns";
import { getDisplayDate } from "@/lib/dateUtils";
import type { Tables } from "@/integrations/supabase/types";

type CategoriaFinanceira = Tables<"categorias_financeiras">;
type ReceitaRow = Tables<"receitas">;
type DespesaRow = Tables<"despesas">;

type CategoriaSelect = Pick<CategoriaFinanceira, "id" | "nome" | "tipo">;
type ReceitaWithCategoria = ReceitaRow & { categorias_financeiras?: CategoriaSelect };
type DespesaWithCategoria = DespesaRow & { categorias_financeiras?: CategoriaSelect };

type ReceitaChartItem = Pick<ReceitaRow, "valor" | "data_recebimento" | "data_vencimento" | "status">;
type DespesaChartItem = Pick<DespesaRow, "valor" | "data_pagamento" | "data_vencimento" | "status">;
export const useFinanceData = (dateFrom?: Date, dateTo?: Date) => {
  return useQuery({
    queryKey: ["finance-data", dateFrom, dateTo],
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const now = new Date();
      const start = dateFrom || startOfMonth(now);
      const end = dateTo || endOfMonth(now);

      const previousStart = subMonths(start, 1);

      const prevFromStr = previousStart.toISOString().split("T")[0];
      const dateToStr = end.toISOString().split("T")[0];

      const [categoriesRes, receitasRes, despesasRes] = await Promise.all([
        supabase.from("categorias_financeiras").select("id, nome, tipo"),
        supabase
          .from("receitas")
          .select("*")
          .neq("status", "Cancelado")
          .gte("data_vencimento", prevFromStr)
          .lte("data_vencimento", dateToStr)
          .order("data_recebimento", { ascending: false })
          .order("data_vencimento", { ascending: false }),
        supabase
          .from("despesas")
          .select("*")
          .eq("is_fatura_payment", false)
          .neq("status", "Cancelado")
          .gte("data_vencimento", prevFromStr)
          .lte("data_vencimento", dateToStr)
          .order("data_vencimento", { ascending: true }),
      ]);

      if (receitasRes.error) throw receitasRes.error;
      if (despesasRes.error) throw despesasRes.error;

      const categoriesMap = new Map<string, CategoriaSelect>(categoriesRes.data?.map((c) => [c.id, c]) || []);

      const receitas: ReceitaWithCategoria[] = (receitasRes.data ?? []).map((r) => ({
        ...r,
        categorias_financeiras: r.categoria_id ? categoriesMap.get(r.categoria_id) : undefined,
      }));

      const despesas: DespesaWithCategoria[] = (despesasRes.data ?? []).map((d) => ({
        ...d,
        categorias_financeiras: d.categoria_id ? categoriesMap.get(d.categoria_id) : undefined,
      }));

      const startStr = start.toISOString().split("T")[0];
      const endStr = end.toISOString().split("T")[0];
      const prevStartStr = previousStart.toISOString().split("T")[0];

      const inMainPeriod = (dateStr: string) => {
        if (!dateStr) return false;
        const dStr = dateStr.split("T")[0];
        return dStr >= startStr && dStr <= endStr;
      };

      const inPreviousPeriod = (dateStr: string) => {
        if (!dateStr) return false;
        const dStr = dateStr.split("T")[0];
        return dStr >= prevStartStr && dStr < startStr;
      };

      const receitasMain = receitas.filter((r) => {
        const displayDate = getDisplayDate(r.data_recebimento, r.data_vencimento, r.status);
        return displayDate && inMainPeriod(displayDate);
      });
      const despesasMain = despesas.filter((d) => {
        const displayDate = getDisplayDate(d.data_pagamento, d.data_vencimento, d.status);
        return displayDate && inMainPeriod(displayDate);
      });

      const receitasPrev = receitas.filter((r) => {
        const displayDate = getDisplayDate(r.data_recebimento, r.data_vencimento, r.status);
        return displayDate && inPreviousPeriod(displayDate);
      });
      const despesasPrev = despesas.filter((d) => {
        const displayDate = getDisplayDate(d.data_pagamento, d.data_vencimento, d.status);
        return displayDate && inPreviousPeriod(displayDate);
      });

      const receitasTotal = receitasMain.reduce((acc, curr) => acc + Number(curr.valor), 0);
      const despesasTotal = despesasMain.reduce((acc, curr) => acc + Number(curr.valor), 0);

      const receitasTotalGeral = receitas.reduce((acc, curr) => acc + Number(curr.valor), 0);
      const despesasTotalGeral = despesas.reduce((acc, curr) => acc + Number(curr.valor), 0);

      const receitasPrevTotal = receitasPrev.reduce((acc, curr) => acc + Number(curr.valor), 0);
      const despesasPrevTotal = despesasPrev.reduce((acc, curr) => acc + Number(curr.valor), 0);

      const receitasGrowth =
        receitasPrevTotal > 0 ? ((receitasTotal - receitasPrevTotal) / receitasPrevTotal) * 100 : 0;

      const despesasGrowth =
        despesasPrevTotal > 0 ? ((despesasTotal - despesasPrevTotal) / despesasPrevTotal) * 100 : 0;

      const receitasChartMain: ReceitaChartItem[] = receitasMain.map((r) => ({
        valor: r.valor,
        data_recebimento: r.data_recebimento,
        data_vencimento: r.data_vencimento,
        status: r.status,
      }));
      const despesasChartMain: DespesaChartItem[] = despesasMain.map((d) => ({
        valor: d.valor,
        data_pagamento: d.data_pagamento,
        data_vencimento: d.data_vencimento,
        status: d.status,
      }));

      const chartData = processChartData(receitasChartMain, despesasChartMain);
      const chartDataDiario = processDailyChartData(receitasMain, despesasMain, start, end);
      const categoriaData = processCategoryData(receitasMain, "receitas");
      const despesasCategoriaData = processCategoryData(despesasMain, "despesas");

      const receitasPendentes = receitasMain.filter((r) => r.status !== "Recebido");
      const despesasPendentes = despesasMain.filter((d) => d.status !== "Pago");

      const aReceber = {
        total: receitasPendentes.reduce((acc, r) => acc + Number(r.valor), 0),
        count: receitasPendentes.length,
      };
      const aPagar = {
        total: despesasPendentes.reduce((acc, d) => acc + Number(d.valor), 0),
        count: despesasPendentes.length,
      };

      const topReceitas = [...receitasMain]
        .sort((a, b) => Number(b.valor) - Number(a.valor))
        .slice(0, 5)
        .map((r) => ({
          id: r.id,
          descricao: r.descricao,
          valor: Number(r.valor),
          data: getDisplayDate(r.data_recebimento, r.data_vencimento, r.status) ?? r.data_vencimento,
          status: r.status,
        }));

      const topDespesas = [...despesasMain]
        .sort((a, b) => Number(b.valor) - Number(a.valor))
        .slice(0, 5)
        .map((d) => ({
          id: d.id,
          descricao: d.descricao,
          valor: Number(d.valor),
          data: getDisplayDate(d.data_pagamento, d.data_vencimento, d.status) ?? d.data_vencimento,
          status: d.status,
        }));

      return {
        stats: {
          receitasTotal,
          despesasTotal,
          receitasTotalGeral,
          despesasTotalGeral,
          receitasMes: receitasGrowth.toFixed(1),
          despesasMes: despesasGrowth.toFixed(1),
          saldo: receitasTotal - despesasTotal,
          saldoGeral: receitasTotalGeral - despesasTotalGeral,
          aReceber,
          aPagar,
        },
        chartData,
        chartDataDiario,
        categoriaData,
        despesasCategoriaData,
        topReceitas,
        topDespesas,
      };
    },
  });
};

interface ChartItem {
  valor: number;
  data_recebimento?: string | null;
  data_pagamento?: string | null;
  data_vencimento: string | null;
  status?: string | null;
}

export const processChartData = (receitas: ReceitaChartItem[], despesas: DespesaChartItem[]) => {
  const monthsMap = new Map<string, { mes: string; receitas: number; despesas: number; sortKey: string }>();

  const processItem = (item: ChartItem, type: "receitas" | "despesas", dateField: string) => {
    const displayDate = getDisplayDate(
      dateField === "data_recebimento" ? item.data_recebimento : null,
      dateField === "data_pagamento" ? item.data_pagamento : item.data_vencimento,
      item.status
    );
    if (!displayDate) return;

    const date = new Date(displayDate);
    const monthName = date.toLocaleString("pt-BR", { month: "short" });
    const year = date.getFullYear().toString().slice(-2);
    const key = `${monthName.charAt(0).toUpperCase() + monthName.slice(1).replace(".", "")}/${year}`;
    const sortKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;

    if (!monthsMap.has(key)) {
      monthsMap.set(key, { mes: key, receitas: 0, despesas: 0, sortKey });
    }

    const current = monthsMap.get(key)!;
    current[type] += Number(item.valor);
  };

  receitas.forEach((r) => processItem(r, "receitas", "data_recebimento"));
  despesas.forEach((d) => processItem(d, "despesas", "data_pagamento"));

  return Array.from(monthsMap.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
};

export const processDailyChartData = (
  receitas: ReceitaWithCategoria[],
  despesas: DespesaWithCategoria[],
  start: Date,
  end: Date
) => {
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Granularidade: diária ≤45d | semanal ≤365d | mensal >365d
  const granularity: "day" | "week" | "month" = daysDiff <= 45 ? "day" : daysDiff <= 365 ? "week" : "month";

  const bucketKey = (date: Date): string => {
    if (granularity === "day") return date.toISOString().split("T")[0];
    if (granularity === "month") {
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
    }
    // week: ISO week start (Monday)
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().split("T")[0];
  };

  const bucketLabel = (key: string): string => {
    if (granularity === "day") {
      return String(parseInt(key.split("-")[2], 10));
    }
    if (granularity === "month") {
      const [year, month] = key.split("-");
      const d = new Date(Number(year), Number(month) - 1, 1);
      return `${d.toLocaleString("pt-BR", { month: "short" }).replace(".", "")}/${year.slice(-2)}`;
    }
    // week: DD/MMM
    const d = new Date(key + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  };

  const bucketsMap = new Map<string, { dia: string; receitas: number; despesas: number }>();

  // Pré-preenche todos os buckets do intervalo
  if (granularity === "day") {
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = bucketKey(d);
      if (!bucketsMap.has(key)) bucketsMap.set(key, { dia: bucketLabel(key), receitas: 0, despesas: 0 });
    }
  } else if (granularity === "week") {
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = bucketKey(d);
      if (!bucketsMap.has(key)) bucketsMap.set(key, { dia: bucketLabel(key), receitas: 0, despesas: 0 });
    }
  } else {
    for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
      const key = bucketKey(d);
      if (!bucketsMap.has(key)) bucketsMap.set(key, { dia: bucketLabel(key), receitas: 0, despesas: 0 });
    }
  }

  const addTo = (date: Date, type: "receitas" | "despesas", valor: number) => {
    if (date < start || date > end) return;
    const key = bucketKey(date);
    const bucket = bucketsMap.get(key);
    if (bucket) bucket[type] += valor;
  };

  receitas.forEach((r) => {
    const displayDate = getDisplayDate(r.data_recebimento, r.data_vencimento, r.status);
    if (displayDate) addTo(new Date(displayDate), "receitas", Number(r.valor));
  });

  despesas.forEach((d) => {
    const displayDate = getDisplayDate(d.data_pagamento, d.data_vencimento, d.status);
    if (displayDate) addTo(new Date(displayDate), "despesas", Number(d.valor));
  });

  return Array.from(bucketsMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, val]) => val);
};

export const processCategoryData = (
  items: (ReceitaWithCategoria | DespesaWithCategoria)[],
  type: "receitas" | "despesas" = "receitas"
) => {
  const categoryMap = new Map<string, { name: string; value: number; color: string }>();

  const greenShades = [
    "hsl(var(--c-green-600))",
    "hsl(var(--c-green-500))",
    "hsl(var(--c-green-400))",
    "hsl(var(--c-green-700))",
    "hsl(var(--c-green-900))",
    "hsl(var(--c-green-200))",
    "hsl(var(--c-green-100))",
    "hsl(var(--c-green-200))",
  ];
  const redShades = [
    "hsl(var(--c-red-600))",
    "hsl(var(--c-red-500))",
    "hsl(var(--c-red-400))",
    "hsl(var(--c-red-700))",
    "hsl(var(--c-red-900))",
    "hsl(var(--c-red-200))",
    "hsl(var(--c-red-100))",
    "hsl(var(--c-red-50))",
  ];

  const colors = type === "receitas" ? greenShades : redShades;

  items.forEach((item) => {
    const categoryName = item.categorias_financeiras?.nome || "Outros";

    if (!categoryMap.has(categoryName)) {
      const colorIndex = categoryMap.size % colors.length;
      const categoryColor = colors[colorIndex];
      categoryMap.set(categoryName, { name: categoryName, value: 0, color: categoryColor });
    }

    const current = categoryMap.get(categoryName)!;
    current.value += Number(item.valor);
  });

  return Array.from(categoryMap.values());
};

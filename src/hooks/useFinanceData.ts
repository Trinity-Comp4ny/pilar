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

type ReceitaChartItem = Pick<ReceitaRow, "valor" | "data_recebimento" | "data_vencimento">;
type DespesaChartItem = Pick<DespesaRow, "valor" | "data_pagamento" | "data_vencimento">;
export const useFinanceData = (dateFrom?: Date, dateTo?: Date) => {
  return useQuery({
    queryKey: ["finance-data", dateFrom, dateTo],
    queryFn: async () => {
      const now = new Date();
      const start = dateFrom || startOfMonth(now);
      const end = dateTo || endOfMonth(now);

      const fetchStart = subMonths(new Date(), 12);

      const { data: categoriesData } = await supabase.from("categorias_financeiras").select("id, nome, tipo");

      const categoriesMap = new Map<string, CategoriaSelect>(categoriesData?.map((c) => [c.id, c]) || []);

      let receitasQuery = supabase
        .from("receitas")
        .select("*")
        .order("data_recebimento", { ascending: false })
        .order("data_vencimento", { ascending: false });

      if (fetchStart) receitasQuery = receitasQuery.gte("data_vencimento", fetchStart.toISOString());
      if (end) receitasQuery = receitasQuery.lte("data_vencimento", end.toISOString());

      const { data: receitasRaw, error: receitasError } = await receitasQuery;
      if (receitasError) throw receitasError;

      const receitas: ReceitaWithCategoria[] | undefined = receitasRaw?.map((r) => ({
        ...r,
        categorias_financeiras: r.categoria_id ? categoriesMap.get(r.categoria_id) : undefined,
      }));

      const { data: receitasChartAllRaw, error: receitasChartAllError } = await supabase
        .from("receitas")
        .select("valor,data_recebimento,data_vencimento")
        .order("data_recebimento", { ascending: false })
        .order("data_vencimento", { ascending: false });

      if (receitasChartAllError) throw receitasChartAllError;

      const { data: receitasAllRaw, error: receitasAllError } = await supabase.from("receitas").select("valor");

      if (receitasAllError) throw receitasAllError;

      let despesasQuery = supabase.from("despesas").select("*").order("data_vencimento", { ascending: true });

      if (fetchStart) despesasQuery = despesasQuery.gte("data_vencimento", fetchStart.toISOString());
      if (end) despesasQuery = despesasQuery.lte("data_vencimento", end.toISOString());

      const { data: despesasRaw, error: despesasError } = await despesasQuery;
      if (despesasError) throw despesasError;

      const despesas: DespesaWithCategoria[] | undefined = despesasRaw?.map((d) => ({
        ...d,
        categorias_financeiras: d.categoria_id ? categoriesMap.get(d.categoria_id) : undefined,
      }));

      const { data: despesasChartAllRaw, error: despesasChartAllError } = await supabase
        .from("despesas")
        .select("valor,data_pagamento,data_vencimento")
        .order("data_vencimento", { ascending: true });

      if (despesasChartAllError) throw despesasChartAllError;

      const { data: despesasAllRaw, error: despesasAllError } = await supabase.from("despesas").select("valor");

      if (despesasAllError) throw despesasAllError;

      const startStr = start.toISOString().split("T")[0];
      const endStr = end.toISOString().split("T")[0];

      const inMainPeriod = (dateStr: string) => {
        if (!dateStr) return false;
        const dStr = dateStr.split("T")[0];
        return dStr >= startStr && dStr <= endStr;
      };

      const previousStart = subMonths(start, 1);
      const prevStartStr = previousStart.toISOString().split("T")[0];

      const inPreviousPeriod = (dateStr: string) => {
        if (!dateStr) return false;
        const dStr = dateStr.split("T")[0];
        return dStr >= prevStartStr && dStr < startStr;
      };

      const receitasMain = (receitas ?? []).filter((r) => {
        const displayDate = getDisplayDate(r.data_recebimento, r.data_vencimento, r.status);
        return displayDate && inMainPeriod(displayDate);
      });
      const despesasMain = (despesas ?? []).filter((d) => {
        const displayDate = getDisplayDate(d.data_pagamento, d.data_vencimento, d.status);
        return displayDate && inMainPeriod(displayDate);
      });

      const receitasChartAll = receitasChartAllRaw ?? [];
      const despesasChartAll = despesasChartAllRaw ?? [];

      const receitasPrev = (receitas ?? []).filter((r) => {
        const displayDate = getDisplayDate(r.data_recebimento, r.data_vencimento, r.status);
        return displayDate && inPreviousPeriod(displayDate);
      });
      const despesasPrev = (despesas ?? []).filter((d) => {
        const displayDate = getDisplayDate(d.data_pagamento, d.data_vencimento, d.status);
        return displayDate && inPreviousPeriod(displayDate);
      });

      const receitasTotal = receitasMain.reduce((acc, curr) => acc + Number(curr.valor), 0);
      const despesasTotal = despesasMain.reduce((acc, curr) => acc + Number(curr.valor), 0);

      const receitasTotalGeral = (receitasAllRaw ?? []).reduce((acc, curr) => acc + Number(curr.valor), 0);
      const despesasTotalGeral = (despesasAllRaw ?? []).reduce((acc, curr) => acc + Number(curr.valor), 0);

      const receitasPrevTotal = receitasPrev.reduce((acc, curr) => acc + Number(curr.valor), 0);
      const despesasPrevTotal = despesasPrev.reduce((acc, curr) => acc + Number(curr.valor), 0);

      const receitasGrowth =
        receitasPrevTotal > 0 ? ((receitasTotal - receitasPrevTotal) / receitasPrevTotal) * 100 : 0;

      const despesasGrowth =
        despesasPrevTotal > 0 ? ((despesasTotal - despesasPrevTotal) / despesasPrevTotal) * 100 : 0;

      const chartData = processChartData(receitasChartAll, despesasChartAll);
      const chartDataDiario = processDailyChartData(receitasMain, despesasMain, start, end);
      const categoriaData = processCategoryData(receitasMain, "receitas");
      const despesasCategoriaData = processCategoryData(despesasMain, "despesas");

      const formattedProjects: never[] = [];

      return {
        stats: {
          receitasTotal,
          despesasTotal,
          receitasTotalGeral,
          despesasTotalGeral,
          receitasMes: receitasGrowth.toFixed(1),
          despesasMes: despesasGrowth.toFixed(1),
          leadsTotal: 0,
          projectsActive: 0,
          saldo: receitasTotal - despesasTotal,
          saldoGeral: receitasTotalGeral - despesasTotalGeral,
        },
        chartData,
        chartDataDiario,
        recentProjects: formattedProjects,
        categoriaData,
        despesasCategoriaData,
      };
    },
  });
};

interface ChartItem {
  valor: number;
  data_recebimento?: string | null;
  data_pagamento?: string | null;
  data_vencimento: string;
  status?: string;
}

const processChartData = (receitas: ReceitaChartItem[], despesas: DespesaChartItem[]) => {
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

const processDailyChartData = (
  receitas: ReceitaWithCategoria[],
  despesas: DespesaWithCategoria[],
  start: Date,
  end: Date
) => {
  const daysMap = new Map<string, { dia: string; receitas: number; despesas: number }>();

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayStr = d.getDate().toString();
    const key = d.toISOString().split("T")[0];
    if (!daysMap.has(key)) {
      daysMap.set(key, { dia: dayStr, receitas: 0, despesas: 0 });
    }
  }

  const processReceitaItem = (item: ReceitaWithCategoria) => {
    const displayDate = getDisplayDate(item.data_recebimento, item.data_vencimento, item.status);
    if (!displayDate) return;

    const date = new Date(displayDate);
    if (date >= start && date <= end) {
      const key = date.toISOString().split("T")[0];
      const current = daysMap.get(key);
      if (current) {
        current.receitas += Number(item.valor);
      }
    }
  };

  const processDespesaItem = (item: DespesaWithCategoria) => {
    const displayDate = getDisplayDate(item.data_pagamento, item.data_vencimento, item.status);
    if (!displayDate) return;

    const date = new Date(displayDate);
    if (date >= start && date <= end) {
      const key = date.toISOString().split("T")[0];
      const current = daysMap.get(key);
      if (current) {
        current.despesas += Number(item.valor);
      }
    }
  };

  receitas.forEach((r) => processReceitaItem(r));
  despesas.forEach((d) => processDespesaItem(d));

  return Array.from(daysMap.entries())
    .sort()
    .map(([_, val]) => val);
};

const processCategoryData = (
  items: (ReceitaWithCategoria | DespesaWithCategoria)[],
  type: "receitas" | "despesas" = "receitas"
) => {
  const categoryMap = new Map<string, { name: string; value: number; color: string }>();

  const greenShades = ["#16a34a", "#22c55e", "#4ade80", "#15803d", "#14532d", "#86efac", "#bbf7d0", "#86efac"];
  const redShades = ["#dc2626", "#ef4444", "#f87171", "#b91c1c", "#7f1d1d", "#fca5a5", "#fecaca", "#fee2e2"];

  const colors = type === "receitas" ? greenShades : redShades;

  items.forEach((item) => {
    const categoryName = item.categorias_financeiras?.nome || "Outros";

    if (!categoryMap.has(categoryName)) {
      const colorIndex = categoryMap.size % colors.length;
      const categoryColor = item.categorias_financeiras?.cor || colors[colorIndex];
      categoryMap.set(categoryName, { name: categoryName, value: 0, color: categoryColor });
    }

    const current = categoryMap.get(categoryName)!;
    current.value += Number(item.valor);
  });

  return Array.from(categoryMap.values());
};

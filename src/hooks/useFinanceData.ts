// Cache policy: dados financeiros (saldo/receitas/despesas) precisam estar fresh.
// staleTime 2min + refetchInterval 5min + refetchOnWindowFocus garantem que o
// usuário sempre veja números próximos da realidade ao voltar pra aba.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subMonths, startOfMonth, endOfMonth, format, parseISO } from "date-fns";
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
      // Sem dateFrom/dateTo = "Todo o período" (spec 024): sem filtro de data, sem
      // comparação com período anterior (não existe "anterior" ao início dos dados).
      const allTime = !dateFrom && !dateTo;
      const now = new Date();
      const start = dateFrom || startOfMonth(now);
      const end = dateTo || endOfMonth(now);

      const previousStart = subMonths(start, 1);

      const prevFromStr = format(previousStart, "yyyy-MM-dd");
      const dateToStr = format(end, "yyyy-MM-dd");

      // Busca por vencimento OU pagamento/recebimento dentro da janela. Um item
      // pago no período mas com vencimento fora dela precisa aparecer no caixa
      // (getDisplayDate agrupa pela data de pagamento/recebimento). Em all-time a
      // busca não tem bounds de data.
      const receitasBase = supabase.from("receitas").select("*").neq("status", "Cancelado");
      const despesasBase = supabase
        .from("despesas")
        .select("*")
        .eq("is_fatura_payment", false)
        .neq("status", "Cancelado");

      const [categoriesRes, receitasRes, despesasRes] = await Promise.all([
        supabase.from("categorias_financeiras").select("id, nome, tipo"),
        (allTime
          ? receitasBase
          : receitasBase.or(
              `and(data_vencimento.gte.${prevFromStr},data_vencimento.lte.${dateToStr}),and(data_recebimento.gte.${prevFromStr},data_recebimento.lte.${dateToStr})`
            )
        )
          .order("data_recebimento", { ascending: false })
          .order("data_vencimento", { ascending: false }),
        (allTime
          ? despesasBase
          : despesasBase.or(
              `and(data_vencimento.gte.${prevFromStr},data_vencimento.lte.${dateToStr}),and(data_pagamento.gte.${prevFromStr},data_pagamento.lte.${dateToStr})`
            )
        ).order("data_vencimento", { ascending: true }),
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

      const startStr = format(start, "yyyy-MM-dd");
      const endStr = format(end, "yyyy-MM-dd");
      const prevStartStr = format(previousStart, "yyyy-MM-dd");

      const inMainPeriod = (dateStr: string) => {
        if (!dateStr) return false;
        if (allTime) return true;
        const dStr = dateStr.split("T")[0];
        return dStr >= startStr && dStr <= endStr;
      };

      const inPreviousPeriod = (dateStr: string) => {
        if (allTime || !dateStr) return false;
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
      // Em all-time a janela do gráfico diário vem do intervalo real dos dados
      // (senão iteraríamos do mês corrente). Span grande cai para granularidade
      // mensal automaticamente em processDailyChartData.
      let dailyStart = start;
      let dailyEnd = end;
      if (allTime) {
        const displayDates: string[] = [];
        receitasMain.forEach((r) => {
          const d = getDisplayDate(r.data_recebimento, r.data_vencimento, r.status);
          if (d) displayDates.push(d.slice(0, 10));
        });
        despesasMain.forEach((d) => {
          const disp = getDisplayDate(d.data_pagamento, d.data_vencimento, d.status);
          if (disp) displayDates.push(disp.slice(0, 10));
        });
        if (displayDates.length) {
          displayDates.sort();
          dailyStart = new Date(displayDates[0] + "T00:00:00");
          dailyEnd = new Date(displayDates[displayDates.length - 1] + "T00:00:00");
        }
      }
      const chartDataDiario = processDailyChartData(receitasMain, despesasMain, dailyStart, dailyEnd);
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

    const date = parseISO(displayDate);
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

  // Coluna date vem como "yyyy-MM-dd"; parse local (T00:00:00) para não cair no
  // dia anterior por causa do fuso ao comparar com start/end (que são locais).
  const parseLocalDate = (dateStr: string) => new Date(dateStr.slice(0, 10) + "T00:00:00");

  receitas.forEach((r) => {
    const displayDate = getDisplayDate(r.data_recebimento, r.data_vencimento, r.status);
    if (displayDate) addTo(parseLocalDate(displayDate), "receitas", Number(r.valor));
  });

  despesas.forEach((d) => {
    const displayDate = getDisplayDate(d.data_pagamento, d.data_vencimento, d.status);
    if (displayDate) addTo(parseLocalDate(displayDate), "despesas", Number(d.valor));
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

  // Matizes distintos (não monocromáticos) para diferenciar fatias adjacentes.
  // Receitas: paleta fria/verde; Despesas: paleta quente/vermelha.
  const receitasColors = [
    "hsl(var(--c-green-600))",
    "hsl(var(--c-emerald-500))",
    "hsl(var(--c-cyan-500))",
    "hsl(var(--c-lime-500))",
    "hsl(var(--c-blue-500))",
    "hsl(var(--c-indigo-500))",
    "hsl(var(--c-violet-500))",
    "hsl(var(--c-purple-500))",
  ];
  const despesasColors = [
    "hsl(var(--c-red-600))",
    "hsl(var(--c-orange-500))",
    "hsl(var(--c-amber-500))",
    "hsl(var(--c-pink-500))",
    "hsl(var(--c-red-400))",
    "hsl(var(--c-orange-700))",
    "hsl(var(--c-yellow-600))",
    "hsl(var(--c-purple-600))",
  ];

  const colors = type === "receitas" ? receitasColors : despesasColors;

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

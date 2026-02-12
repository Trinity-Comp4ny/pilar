import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subMonths, startOfMonth, endOfMonth } from "date-fns";
import { getDisplayDate } from "@/lib/dateUtils";

export const useDashboardData = (dateFrom?: Date, dateTo?: Date) => {
  return useQuery({
    queryKey: ["dashboard-data", dateFrom, dateTo],
    queryFn: async () => {
      // Default to current month if no dates provided
      const now = new Date();
      const start = dateFrom || startOfMonth(now);
      const end = dateTo || endOfMonth(now);

      // Fetch data from 12 months before start to calculate growth and show history
      const fetchStart = subMonths(new Date(), 12);

      // 1. Fetch Categories first
      console.log('[DASHBOARD] Fetching categories...');
      const { data: categoriesData, error: categoriesError } = await (supabase as any)
        .from('categorias_financeiras')
        .select('id, nome, tipo');

      console.log('[DASHBOARD] Categories:', {
        count: categoriesData?.length,
        error: categoriesError,
        errorDetails: categoriesError ? JSON.stringify(categoriesError, null, 2) : null
      });

      const categoriesMap = new Map(categoriesData?.map((c: any) => [c.id, c]) || []);

      // 2. Fetch Receitas
      console.log('[DASHBOARD] Fetching receitas...');
      let receitasQuery = supabase
        .from("receitas")
        .select("*")
        .order("data_recebimento", { ascending: false }) // Ordena por data_recebimento (automação Bradesco)
        .order("data_vencimento", { ascending: false }); // Fallback para data_vencimento (manual)

      if (fetchStart) receitasQuery = receitasQuery.gte('data_vencimento', fetchStart.toISOString());
      if (end) receitasQuery = receitasQuery.lte('data_vencimento', end.toISOString());

      const { data: receitasRaw, error: receitasError } = await receitasQuery;

      console.log('[DASHBOARD] Receitas:', {
        count: receitasRaw?.length,
        error: receitasError,
        sample: receitasRaw?.[0]
      });

      if (receitasError) {
        console.error('[DASHBOARD] Receitas error:', receitasError);
        throw receitasError;
      }

      const receitas = receitasRaw?.map((r: any) => ({
        ...r,
        categorias_financeiras: categoriesMap.get(r.categoria_id)
      }));

      // 2a. Fetch Receitas (All time) for Chart
      const { data: receitasChartAllRaw, error: receitasChartAllError } = await supabase
        .from("receitas")
        .select("valor,data_recebimento,data_vencimento")
        .order("data_recebimento", { ascending: false }) // Ordena por data_recebimento (automação Bradesco)
        .order("data_vencimento", { ascending: false }); // Fallback para data_vencimento (manual)

      if (receitasChartAllError) {
        console.error('[DASHBOARD] Receitas chart all time error:', receitasChartAllError);
        throw receitasChartAllError;
      }

      // 2b. Fetch Receitas (Total Geral)
      const { data: receitasAllRaw, error: receitasAllError } = await supabase
        .from("receitas")
        .select("valor");

      if (receitasAllError) {
        console.error('[DASHBOARD] Receitas total geral error:', receitasAllError);
        throw receitasAllError;
      }

      // 3. Fetch Despesas
      console.log('[DASHBOARD] Fetching despesas...');
      let despesasQuery = supabase
        .from("despesas")
        .select("*")
        .order("data_vencimento", { ascending: true });

      if (fetchStart) despesasQuery = despesasQuery.gte('data_vencimento', fetchStart.toISOString());
      if (end) despesasQuery = despesasQuery.lte('data_vencimento', end.toISOString());

      const { data: despesasRaw, error: despesasError } = await despesasQuery;

      console.log('[DASHBOARD] Despesas:', {
        count: despesasRaw?.length,
        error: despesasError,
        sample: despesasRaw?.[0]
      });

      if (despesasError) {
        console.error('[DASHBOARD] Despesas error:', despesasError);
        throw despesasError;
      }

      const despesas = despesasRaw?.map((d: any) => ({
        ...d,
        categorias_financeiras: categoriesMap.get(d.categoria_id)
      }));

      // 3a. Fetch Despesas (All time) for Chart
      const { data: despesasChartAllRaw, error: despesasChartAllError } = await supabase
        .from("despesas")
        .select("valor,data_pagamento,data_vencimento")
        .order("data_vencimento", { ascending: true });

      if (despesasChartAllError) {
        console.error('[DASHBOARD] Despesas chart all time error:', despesasChartAllError);
        throw despesasChartAllError;
      }

      // 3b. Fetch Despesas (Total Geral)
      const { data: despesasAllRaw, error: despesasAllError } = await supabase
        .from("despesas")
        .select("valor");

      if (despesasAllError) {
        console.error('[DASHBOARD] Despesas total geral error:', despesasAllError);
        throw despesasAllError;
      }

      // 4. Fetch Leads (Total Novos)
      let leadsCount = 0;
      try {
        const { count, error: leadsError } = await (supabase as any)
          .from("leads")
          .select("*", { count: 'exact', head: true });

        if (!leadsError) {
          leadsCount = count || 0;
        }
      } catch (e) {
        console.log("Leads table might not exist yet");
      }

      // 5. Fetch Recent Projects
      let recentProjects = [];
      let projectsCount = 0;

      try {
        console.log('[DASHBOARD] Fetching projects...');

        // First fetch count
        const { count, error: countError } = await supabase
          .from("projetos")
          .select("*", { count: 'exact', head: true })
          .eq("status", "Em andamento");

        if (!countError) projectsCount = count || 0;

        // Then fetch data
        const { data: projectsData, error: projectsError } = await supabase
          .from("projetos")
          .select(`
            id,
            codigo_projeto,
            status,
            valor_contrato,
            cliente_id,
            clientes (
              nome
            )
          `)
          .order("created_at", { ascending: false })
          .limit(5);

        if (projectsError) {
          console.error('[DASHBOARD] Projects error:', projectsError);
        } else {
          recentProjects = projectsData || [];
          console.log('[DASHBOARD] Projects fetched:', recentProjects.length);
        }
      } catch (error) {
        console.error('[DASHBOARD] Projects unexpected error:', error);
      }

      // Filter data for the Main Period (dateFrom to dateTo)
      // Use string comparison to avoid timezone issues with dates
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];

      const inMainPeriod = (dateStr: string) => {
        if (!dateStr) return false;
        // dateStr from supabase is usually YYYY-MM-DD
        const dStr = dateStr.split('T')[0];
        return dStr >= startStr && dStr <= endStr;
      };

      // Filter data for the Previous Period (subMonths(start, 1) to start)
      const previousStart = subMonths(start, 1);
      const prevStartStr = previousStart.toISOString().split('T')[0];

      const inPreviousPeriod = (dateStr: string) => {
        if (!dateStr) return false;
        const dStr = dateStr.split('T')[0];
        return dStr >= prevStartStr && dStr < startStr;
      };

      // Stats Calculation
      console.log('[DASHBOARD] Period filters:', { start, end, fetchStart });
      console.log('[DASHBOARD] Raw data before filtering:', {
        totalReceitas: receitas?.length,
        totalDespesas: despesas?.length,
        receitasSample: receitas?.[0],
        despesasSample: despesas?.[0]
      });

      // Para receitas: usar data_recebimento se existir (automação Bradesco), senão data_vencimento (manual)
      const receitasMain = (receitas as any[])?.filter(r => {
        const displayDate = getDisplayDate(r.data_recebimento, r.data_vencimento, r.status);
        return displayDate && inMainPeriod(displayDate);
      }) || [];
      // Para despesas: usar data_pagamento se existir, senão data_vencimento
      const despesasMain = (despesas as any[])?.filter(d => {
        const displayDate = getDisplayDate(d.data_pagamento, d.data_vencimento, d.status);
        return displayDate && inMainPeriod(displayDate);
      }) || [];

      const receitasChartAll = (receitasChartAllRaw as any[]) || [];
      const despesasChartAll = (despesasChartAllRaw as any[]) || [];

      const receitasPrev = (receitas as any[])?.filter(r => {
        const displayDate = getDisplayDate(r.data_recebimento, r.data_vencimento, r.status);
        return displayDate && inPreviousPeriod(displayDate);
      }) || [];
      const despesasPrev = (despesas as any[])?.filter(d => {
        const displayDate = getDisplayDate(d.data_pagamento, d.data_vencimento, d.status);
        return displayDate && inPreviousPeriod(displayDate);
      }) || [];

      const receitasTotal = receitasMain.reduce((acc, curr) => acc + Number(curr.valor), 0);
      const despesasTotal = despesasMain.reduce((acc, curr) => acc + Number(curr.valor), 0);

      const receitasTotalGeral = (receitasAllRaw as any[])?.reduce((acc, curr) => acc + Number(curr.valor), 0) || 0;
      const despesasTotalGeral = (despesasAllRaw as any[])?.reduce((acc, curr) => acc + Number(curr.valor), 0) || 0;

      console.log('[DASHBOARD] Calculations:', {
        receitasMain: receitasMain.length,
        despesasMain: despesasMain.length,
        receitasTotal,
        despesasTotal,
        receitasMainSample: receitasMain[0],
        despesasMainSample: despesasMain[0]
      });

      const receitasPrevTotal = receitasPrev.reduce((acc, curr) => acc + Number(curr.valor), 0);
      const despesasPrevTotal = despesasPrev.reduce((acc, curr) => acc + Number(curr.valor), 0);

      const receitasGrowth = receitasPrevTotal > 0
        ? ((receitasTotal - receitasPrevTotal) / receitasPrevTotal) * 100
        : 0;

      const despesasGrowth = despesasPrevTotal > 0
        ? ((despesasTotal - despesasPrevTotal) / despesasPrevTotal) * 100
        : 0;

      // Process Chart Data (Group by Month or Day depending on range duration)
      // We pass the CHART data (all time)
      const chartData = processChartData(receitasChartAll, despesasChartAll);

      // Daily chart data for the selected period
      const chartDataDiario = processDailyChartData(receitasMain, despesasMain, start, end);

      // Process Category Data
      const categoriaData = processCategoryData(receitasMain, 'receitas');
      const despesasCategoriaData = processCategoryData(despesasMain, 'despesas');

      // Format Recent Projects
      const formattedProjects = recentProjects?.map(p => ({
        id: p.id,
        name: p.codigo_projeto || "Sem Nome",
        status: p.status || "Pendente",
        client: p.clientes?.nome || "Cliente não informado",
        value: p.valor_contrato ? `R$ ${Number(p.valor_contrato).toLocaleString('pt-BR')}` : "R$ 0,00"
      })) || [];

      return {
        stats: {
          receitasTotal,
          despesasTotal,
          receitasTotalGeral,
          despesasTotalGeral,
          receitasMes: receitasGrowth.toFixed(1),
          despesasMes: despesasGrowth.toFixed(1),
          leadsTotal: leadsCount,
          projectsActive: projectsCount || 0,
          saldo: receitasTotal - despesasTotal,
          saldoGeral: receitasTotalGeral - despesasTotalGeral
        },
        chartData,
        chartDataDiario,
        recentProjects: formattedProjects,
        categoriaData,
        despesasCategoriaData,
        debug: {
          receitasCount: receitasRaw?.length || 0,
          despesasCount: despesasRaw?.length || 0,
          receitasError: receitasError?.message,
          despesasError: despesasError?.message,
          periodStart: start.toISOString(),
          periodEnd: end.toISOString()
        }
      };
    }
  });
};

const processChartData = (receitas: any[], despesas: any[]) => {
  const monthsMap = new Map<string, { mes: string; receitas: number; despesas: number; sortKey: string }>();

  // Helper
  const processItem = (item: any, type: 'receitas' | 'despesas', dateField: string) => {
    const displayDate = getDisplayDate(
      dateField === 'data_recebimento' ? item.data_recebimento : null,
      dateField === 'data_pagamento' ? item.data_pagamento : item.data_vencimento,
      item.status
    );
    if (!displayDate) return;

    const date = new Date(displayDate);
    const monthName = date.toLocaleString('pt-BR', { month: 'short' });
    const year = date.getFullYear().toString().slice(-2);
    const key = `${monthName.charAt(0).toUpperCase() + monthName.slice(1).replace('.', '')}/${year}`;
    const sortKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

    if (!monthsMap.has(key)) {
      monthsMap.set(key, { mes: key, receitas: 0, despesas: 0, sortKey });
    }

    const current = monthsMap.get(key)!;
    current[type] += Number(item.valor);
  };

  receitas.forEach(r => processItem(r, 'receitas', 'data_recebimento')); // Usa data_recebimento (automação Bradesco)
  despesas.forEach(d => processItem(d, 'despesas', 'data_pagamento')); // Usa data_pagamento

  return Array.from(monthsMap.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
};

const processDailyChartData = (receitas: any[], despesas: any[], start: Date, end: Date) => {
  const daysMap = new Map<string, { dia: string; receitas: number; despesas: number }>();

  // Helper to fill all days in range
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayStr = d.getDate().toString();
    const key = d.toISOString().split('T')[0]; // Unique key YYYY-MM-DD
    if (!daysMap.has(key)) {
      daysMap.set(key, { dia: dayStr, receitas: 0, despesas: 0 });
    }
  }

  const processItem = (item: any, type: 'receitas' | 'despesas', dateField: string) => {
    const displayDate = getDisplayDate(
      dateField === 'data_recebimento' ? item.data_recebimento : null,
      dateField === 'data_pagamento' ? item.data_pagamento : item.data_vencimento,
      item.status
    );
    if (!displayDate) return;

    const date = new Date(displayDate);
    if (date >= start && date <= end) {
      const key = date.toISOString().split('T')[0];
      const current = daysMap.get(key);
      if (current) {
        current[type] += Number(item.valor);
      }
    }
  };

  receitas.forEach(r => processItem(r, 'receitas', 'data_recebimento')); // Usa data_recebimento (automação Bradesco)
  despesas.forEach(d => processItem(d, 'despesas', 'data_pagamento')); // Usa data_pagamento

  // Sort by date
  return Array.from(daysMap.entries()).sort().map(([_, val]) => val);
};

const processCategoryData = (items: any[], type: 'receitas' | 'despesas' = 'receitas') => {
  const categoryMap = new Map<string, { name: string; value: number; color: string }>();
  
  const greenShades = ["#16a34a", "#22c55e", "#4ade80", "#15803d", "#14532d", "#86efac", "#bbf7d0", "#86efac"];
  const redShades = ["#dc2626", "#ef4444", "#f87171", "#b91c1c", "#7f1d1d", "#fca5a5", "#fecaca", "#fee2e2"];

  const colors = type === 'receitas' ? greenShades : redShades;

  items.forEach((item, index) => {
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

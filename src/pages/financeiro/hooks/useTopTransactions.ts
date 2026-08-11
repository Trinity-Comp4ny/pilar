import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

// Top 5 receitas e despesas do período, usado no Resumo Mensal e no Fluxo de Caixa.
// Despesas filtra is_fatura_payment=false e status!='Cancelado' para não contar o
// débito "Pgto Fatura" (que espelha o total do cartão) em dobro.
// Sem dateFrom/dateTo = "Todo o período" (spec 024): sem filtro de data.
export function useTopTransactions(dateFrom?: Date, dateTo?: Date) {
  return useQuery({
    queryKey: ["top-transactions-month", dateFrom, dateTo],
    queryFn: async () => {
      // Coluna date: formata local (yyyy-MM-dd), nunca toISOString (evita off-by-one de fuso).
      const firstDay = dateFrom ? format(dateFrom, "yyyy-MM-dd") : null;
      const lastDay = dateTo ? format(dateTo, "yyyy-MM-dd") : null;

      let receitasQuery = supabase.from("receitas").select("*");
      if (firstDay) receitasQuery = receitasQuery.gte("data_recebimento", firstDay);
      if (lastDay) receitasQuery = receitasQuery.lte("data_recebimento", lastDay);
      const { data: receitas } = await receitasQuery.order("valor", { ascending: false }).limit(5);

      let despesasQuery = supabase
        .from("despesas")
        .select("*, categorias_financeiras(nome)")
        .eq("is_fatura_payment", false)
        .neq("status", "Cancelado");
      if (firstDay) despesasQuery = despesasQuery.gte("data_pagamento", firstDay);
      if (lastDay) despesasQuery = despesasQuery.lte("data_pagamento", lastDay);
      const { data: despesas } = await despesasQuery.order("valor", { ascending: false }).limit(5);

      return {
        receitas: receitas || [],
        despesas: despesas || [],
      };
    },
  });
}

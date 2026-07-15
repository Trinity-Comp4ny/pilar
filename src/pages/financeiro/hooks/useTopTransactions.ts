import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, format } from "date-fns";

// Top 5 receitas e despesas do período, usado no Resumo Mensal e no Fluxo de Caixa.
// Despesas filtra is_fatura_payment=false e status!='Cancelado' para não contar o
// débito "Pgto Fatura" (que espelha o total do cartão) em dobro.
export function useTopTransactions(dateFrom?: Date, dateTo?: Date) {
  return useQuery({
    queryKey: ["top-transactions-month", dateFrom, dateTo],
    queryFn: async () => {
      const today = new Date();
      const start = dateFrom || startOfMonth(today);
      const end = dateTo || endOfMonth(today);

      // Coluna date: formata local (yyyy-MM-dd), nunca toISOString (evita off-by-one de fuso).
      const firstDay = format(start, "yyyy-MM-dd");
      const lastDay = format(end, "yyyy-MM-dd");

      const { data: receitas } = await supabase
        .from("receitas")
        .select("*")
        .gte("data_recebimento", firstDay)
        .lte("data_recebimento", lastDay)
        .order("valor", { ascending: false })
        .limit(5);

      const { data: despesas } = await supabase
        .from("despesas")
        .select("*, categorias_financeiras(nome)")
        .eq("is_fatura_payment", false)
        .neq("status", "Cancelado")
        .gte("data_pagamento", firstDay)
        .lte("data_pagamento", lastDay)
        .order("valor", { ascending: false })
        .limit(5);

      return {
        receitas: receitas || [],
        despesas: despesas || [],
      };
    },
  });
}

// Dados do relatório financeiro (receitas/despesas): busca paginada,
// normalização em linhas de tabela e estado de carregamento/título.
//
// A "data de referência" por registro é única e por tipo: efetivado
// (recebido/pago) filtra pela data efetiva; pendente filtra pelo vencimento.
// A lógica de dinheiro aqui é a mesma da página original, apenas movida.
import { useState } from "react";
import { startOfDay, endOfDay } from "date-fns";
import { getDisplayDate, formatDateDisplay } from "@/lib/dateUtils";
import { monitoring } from "@/lib/monitoring";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ReportRow {
  Tipo: string;
  Descrição: string;
  Valor: number;
  "Dt. Vencimento": string;
  "Dt. Efetiva": string;
  Status: string;
  Projeto: string;
  "Cliente / Fornecedor": string;
  Categoria: string;
  Conta: string;
  "Forma Pgto": string;
  "Nota Fiscal": string;
  Parcela: string;
}

export interface FinancialRecord {
  descricao: string | null;
  valor: number | null;
  data_recebimento?: string | null;
  data_pagamento?: string | null;
  data_vencimento: string | null;
  status: string | null;
  nota_fiscal: string | null;
  forma_pagamento?: string | null;
  observacao: string | null;
  parcela_numero: number | null;
  parcela_total: number | null;
  projetos: { nome: string } | null;
  clientes?: { nome: string } | null;
  fornecedores?: { nome: string } | null;
  categorias_financeiras: { nome: string } | null;
  contas: { nome: string } | null;
}

// Converte a string de data exibida (dd/MM/yyyy) de volta em Date, ou null.
export function parseDDMMYYYY(str: string): Date | null {
  if (str === "-") return null;
  const [d, m, y] = str.split("/").map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

// Normaliza registros crus em linhas de tabela. A data efetiva vem de
// getDisplayDate (recebido/pago quando efetivado, vencimento quando pendente).
export function processData(data: FinancialRecord[], tipo: "receitas" | "despesas"): ReportRow[] {
  return (data || []).map((item) => {
    const dataEfetiva = tipo === "receitas" ? item.data_recebimento : item.data_pagamento;
    const parcela = item.parcela_numero && item.parcela_total ? `${item.parcela_numero}/${item.parcela_total}` : "-";

    return {
      Tipo: tipo === "receitas" ? "Receita" : "Despesa",
      Descrição: item.descricao ?? "-",
      Valor: item.valor ?? 0,
      "Dt. Vencimento": formatDateDisplay(item.data_vencimento) || "-",
      "Dt. Efetiva": formatDateDisplay(getDisplayDate(dataEfetiva, item.data_vencimento, item.status)) || "-",
      Status: item.status ?? "-",
      Projeto: item.projetos?.nome ?? "-",
      "Cliente / Fornecedor": tipo === "receitas" ? (item.clientes?.nome ?? "-") : (item.fornecedores?.nome ?? "-"),
      Categoria: item.categorias_financeiras?.nome ?? "-",
      Conta: item.contas?.nome ?? "-",
      "Forma Pgto": item.forma_pagamento ?? "-",
      "Nota Fiscal": item.nota_fiscal ?? "-",
      Parcela: parcela,
    };
  });
}

// Busca paginada (1000 por página) de receitas ou despesas com o filtro de
// período por data de referência única. Ver comentário sobre o .or() abaixo.
export async function fetchFinancialData(
  tipo: "receitas" | "despesas",
  dateFrom?: Date,
  dateTo?: Date
): Promise<FinancialRecord[]> {
  const pageLimit = 1000;
  const MAX_PAGES = 50; // teto de segurança: até 50k registros por relatório (ACH-REL-01)
  let page = 0;
  const all: FinancialRecord[] = [];

  while (page < MAX_PAGES) {
    // Build separate typed query branches to avoid redundant .select() override
    // and to apply is_fatura_payment only on despesas
    const { data, error } = await (() => {
      let q =
        tipo === "receitas"
          ? supabase
              .from("receitas")
              .select(
                "*, projetos (nome), categorias_financeiras (nome), contas (nome), clientes (nome)"
              )
              .is("deleted_at", null)
          : supabase
              .from("despesas")
              .select(
                "*, projetos (nome), categorias_financeiras (nome), contas (nome), fornecedores (nome)"
              )
              .is("deleted_at", null)
              .eq("is_fatura_payment", false);

      if (tipo === "receitas") {
        q = q.order("data_recebimento", { ascending: false }).order("data_vencimento", { ascending: false });
      } else {
        q = q.order("data_pagamento", { ascending: false }).order("data_vencimento", { ascending: false });
      }

      // Filtro de período por UMA única data de referência por registro:
      // efetivado (recebido/pago) filtra pela data efetiva; pendente filtra
      // pelo vencimento. Antes eram dois .or() (gte e lte) combinados por AND
      // no topo, o que deixava entrar registro com uma data dentro e a outra
      // fora, inflando os totais. Aqui cada intervalo (início E fim) recai
      // sobre a mesma coluna dentro de um único .or().
      const effCol = tipo === "receitas" ? "data_recebimento" : "data_pagamento";
      const dueCol = "data_vencimento";
      const start = dateFrom ? startOfDay(dateFrom).toISOString() : null;
      const end = dateTo ? endOfDay(dateTo).toISOString() : null;

      if (start || end) {
        const effBounds = [
          start && `${effCol}.gte.${start}`,
          end && `${effCol}.lte.${end}`,
        ].filter(Boolean) as string[];
        const dueBounds = [
          `${effCol}.is.null`,
          start && `${dueCol}.gte.${start}`,
          end && `${dueCol}.lte.${end}`,
        ].filter(Boolean) as string[];
        q = q.or(`and(${effBounds.join(",")}),and(${dueBounds.join(",")})`);
      }

      return q.range(page * pageLimit, page * pageLimit + pageLimit - 1);
    })();

    if (error) throw error;

    const chunk = (data as FinancialRecord[]) || [];
    all.push(...chunk);
    if (chunk.length < pageLimit) break;
    page += 1;
  }

  if (page >= MAX_PAGES) {
    monitoring.captureMessage(
      "Relatório atingiu o teto de 50k registros; resultado pode estar truncado",
      "warning"
    );
  }

  return all;
}

interface GenerateReportOpts {
  tipoRelatorio: string;
  dateFrom?: Date;
  dateTo?: Date;
  title: string;
}

// Estado e orquestração da geração do relatório financeiro (fetch + process +
// ordenação + feedback). Rentabilidade tem fluxo próprio e não passa por aqui.
export function useRelatorioData() {
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [reportTitle, setReportTitle] = useState<string>("");

  const clearReport = () => {
    setReportData([]);
    setReportTitle("");
  };

  const generateReport = async ({ tipoRelatorio, dateFrom, dateTo, title }: GenerateReportOpts) => {
    setIsLoading(true);

    try {
      let finalData: ReportRow[] = [];

      if (tipoRelatorio === "financeiro") {
        const [receitas, despesas] = await Promise.all([
          fetchFinancialData("receitas", dateFrom, dateTo),
          fetchFinancialData("despesas", dateFrom, dateTo),
        ]);

        const receitasProc = processData(receitas || [], "receitas");
        const despesasProc = processData(despesas || [], "despesas");
        finalData = [...receitasProc, ...despesasProc];

        finalData.sort((a, b) => {
          const dateA = parseDDMMYYYY(a["Dt. Efetiva"]);
          const dateB = parseDDMMYYYY(b["Dt. Efetiva"]);
          return (dateB?.getTime() ?? 0) - (dateA?.getTime() ?? 0);
        });
      } else if (["receitas", "despesas"].includes(tipoRelatorio)) {
        const data = await fetchFinancialData(tipoRelatorio as "receitas" | "despesas", dateFrom, dateTo);
        finalData = processData(data || [], tipoRelatorio as "receitas" | "despesas");
      }

      if (finalData.length === 0) {
        toast.error("Sem dados", { description: "Não foram encontrados dados para os filtros selecionados." });
        setIsLoading(false);
        setReportData([]);
        setReportTitle("");
        return;
      }

      setReportTitle(title);
      setReportData(finalData);

      toast.success("Relatório gerado", {
        description: `${finalData.length} registros carregados. Exporte em CSV ou PDF.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Erro ao gerar relatório:", err);
      toast.error("Erro ao gerar", { description: message });
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, setIsLoading, reportData, reportTitle, generateReport, clearReport };
}

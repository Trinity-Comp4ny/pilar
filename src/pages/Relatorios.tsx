import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Download, Plus, FileBarChart, Filter, X, Columns3, Sparkles } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getDisplayDate, formatDateDisplay } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useRelatorioExecutivo } from "@/hooks/useRelatorioExecutivo";
import { RelatoriosSummary } from "./relatorios/RelatoriosSummary";

interface ReportRow {
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

interface FinancialRecord {
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

const toCurrency = (value: string | number | null | undefined) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n);
};

const statusConfig: Record<string, { label: string; className: string }> = {
  Pendente: { label: "Pendente", className: "bg-amber-100 text-amber-800 border-amber-200" },
  Pago: { label: "Pago", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  Recebido: { label: "Recebido", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  Atrasado: { label: "Atrasado", className: "bg-red-100 text-red-800 border-red-200" },
  Cancelado: { label: "Cancelado", className: "bg-gray-100 text-gray-500 border-gray-200" },
};

const tipoConfig: Record<string, { className: string }> = {
  Receita: { className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  Despesa: { className: "bg-red-100 text-red-800 border-red-200" },
};

function parseDDMMYYYY(str: string): Date | null {
  if (str === "-") return null;
  const [d, m, y] = str.split("/").map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

export default function Relatorios() {
  usePageTitle("Relatórios");
  const { gerar: gerarExecutivo, isGenerating: isExecutivoLoading } = useRelatorioExecutivo();
  const [tipoRelatorio, setTipoRelatorio] = useState("");
  const [periodoPreset, setPeriodoPreset] = useState<"7d" | "30d" | "this_month" | "last_month" | "all" | "custom">(
    "all"
  );
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [reportTitle, setReportTitle] = useState<string>("");

  const ALL_COLUMNS: (keyof ReportRow)[] = [
    "Tipo",
    "Descrição",
    "Valor",
    "Dt. Vencimento",
    "Dt. Efetiva",
    "Status",
    "Projeto",
    "Cliente / Fornecedor",
    "Categoria",
    "Conta",
    "Forma Pgto",
    "Nota Fiscal",
    "Parcela",
  ];
  const DEFAULT_VISIBLE = new Set<keyof ReportRow>([
    "Tipo",
    "Descrição",
    "Valor",
    "Dt. Vencimento",
    "Status",
    "Cliente / Fornecedor",
    "Categoria",
  ]);

  const [visibleColumns, setVisibleColumns] = useState<Set<keyof ReportRow>>(() => {
    try {
      const saved = localStorage.getItem("relatorios.columns");
      if (saved) return new Set(JSON.parse(saved) as (keyof ReportRow)[]);
    } catch {
      /* ignore */
    }
    return DEFAULT_VISIBLE;
  });

  const toggleColumn = (col: keyof ReportRow) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) {
        if (next.size > 1) next.delete(col);
      } else next.add(col);
      localStorage.setItem("relatorios.columns", JSON.stringify([...next]));
      return next;
    });
  };

  // --- Filtros de coluna ---
  const [filterCategoria, setFilterCategoria] = useState<string>("");
  const [filterCliente, setFilterCliente] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterProjeto, setFilterProjeto] = useState<string>("");
  const [filterConta, setFilterConta] = useState<string>("");

  const hasActiveFilters = !!(filterCategoria || filterCliente || filterStatus || filterProjeto || filterConta);

  const clearAllFilters = () => {
    setFilterCategoria("");
    setFilterCliente("");
    setFilterStatus("");
    setFilterProjeto("");
    setFilterConta("");
  };

  // Aplica todos os filtros exceto o indicado em `exclude`
  const applyFilters = (data: ReportRow[], exclude?: string) => {
    return data.filter((row) => {
      if (exclude !== "categoria" && filterCategoria && row.Categoria !== filterCategoria) return false;
      if (exclude !== "cliente" && filterCliente && row["Cliente / Fornecedor"] !== filterCliente) return false;
      if (exclude !== "status" && filterStatus && row.Status !== filterStatus) return false;
      if (exclude !== "projeto" && filterProjeto && row.Projeto !== filterProjeto) return false;
      if (exclude !== "conta" && filterConta && row.Conta !== filterConta) return false;
      return true;
    });
  };

  // Dados filtrados (todos os filtros aplicados)
  const filteredData = useMemo(
    () => applyFilters(reportData),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reportData, filterCategoria, filterCliente, filterStatus, filterProjeto, filterConta]
  );

  // Opções inteligentes: cada select mostra apenas valores compatíveis com os demais filtros
  const filterOptions = useMemo(() => {
    const unique = (data: ReportRow[], key: keyof ReportRow) =>
      Array.from(new Set(data.map((r) => r[key]).filter((v) => v && v !== "-"))).sort() as string[];

    return {
      categorias: unique(applyFilters(reportData, "categoria"), "Categoria"),
      clientes: unique(applyFilters(reportData, "cliente"), "Cliente / Fornecedor"),
      status: unique(applyFilters(reportData, "status"), "Status"),
      projetos: unique(applyFilters(reportData, "projeto"), "Projeto"),
      contas: unique(applyFilters(reportData, "conta"), "Conta"),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportData, filterCategoria, filterCliente, filterStatus, filterProjeto, filterConta]);

  // Limpa filtros órfãos (valor selecionado não existe mais nas opções disponíveis)
  useEffect(() => {
    if (filterCategoria && !filterOptions.categorias.includes(filterCategoria)) setFilterCategoria("");
    if (filterCliente && !filterOptions.clientes.includes(filterCliente)) setFilterCliente("");
    if (filterStatus && !filterOptions.status.includes(filterStatus)) setFilterStatus("");
    if (filterProjeto && !filterOptions.projetos.includes(filterProjeto)) setFilterProjeto("");
    if (filterConta && !filterOptions.contas.includes(filterConta)) setFilterConta("");
  }, [filterOptions, filterCategoria, filterCliente, filterStatus, filterProjeto, filterConta]);

  // --- Dados derivados ---

  const summary = useMemo(() => {
    const totalReceitas = filteredData.filter((r) => r.Tipo === "Receita").reduce((acc, r) => acc + (r.Valor ?? 0), 0);
    const totalDespesas = filteredData.filter((r) => r.Tipo === "Despesa").reduce((acc, r) => acc + (r.Valor ?? 0), 0);
    const saldo = totalReceitas - totalDespesas;
    const total = filteredData.reduce((acc, r) => acc + (r.Valor ?? 0), 0);
    return { totalReceitas, totalDespesas, saldo, total };
  }, [filteredData]);

  const chartData = useMemo(() => {
    const monthMap = new Map<string, { receitas: number; despesas: number }>();

    for (const row of filteredData) {
      const date = parseDDMMYYYY(row["Dt. Efetiva"]);
      if (!date) continue;
      const key = format(date, "MMM/yy", { locale: ptBR });
      const sortKey = format(date, "yyyy-MM");
      const existing = monthMap.get(sortKey) ?? { receitas: 0, despesas: 0 };

      if (row.Tipo === "Receita") {
        existing.receitas += row.Valor ?? 0;
      } else {
        existing.despesas += row.Valor ?? 0;
      }
      monthMap.set(sortKey, existing);
      // store display label
      (existing as Record<string, unknown>)._label = key;
    }

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({
        mes: (v as Record<string, unknown>)._label as string,
        Receitas: v.receitas,
        Despesas: v.despesas,
      }));
  }, [filteredData]);

  // --- Helpers ---

  const processData = (data: FinancialRecord[], tipo: "receitas" | "despesas"): ReportRow[] => {
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
  };

  const generateCSV = (data: ReportRow[], filename: string) => {
    if (!data.length) {
      toast.error("Sem dados", { description: "Não há dados para exportar." });
      return;
    }

    const escapeCSV = (value: unknown) => {
      const str = value === null || value === undefined ? "" : String(value);
      return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const columns = Object.keys(data[0]);
    const headers = columns.join(",");
    const rows = data.map((row) =>
      columns
        .map((c) => {
          if (c === "Valor") return escapeCSV(toCurrency(row.Valor));
          return escapeCSV(row[c as keyof ReportRow]);
        })
        .join(",")
    );

    // Linha de total
    const totalValue = data.reduce((acc, r) => acc + (r.Valor ?? 0), 0);
    const totalRow = columns
      .map((col) => {
        if (col === "Tipo") return escapeCSV("TOTAL");
        if (col === "Valor") return escapeCSV(toCurrency(totalValue));
        return "";
      })
      .join(",");

    const csvContent = [headers, ...rows, totalRow].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchFinancialData = async (tipo: "receitas" | "despesas") => {
    const pageLimit = 1000;
    let page = 0;
    const all: FinancialRecord[] = [];

    while (true) {
      let query = supabase.from(tipo).select(`
        *,
        projetos (nome),
        categorias_financeiras (nome),
        contas (nome)
      `);

      if (tipo === "receitas") {
        query = query.select(`
          *,
          projetos (nome),
          categorias_financeiras (nome),
          contas (nome),
          clientes (nome)
        `);
      } else {
        query = query.select(`
          *,
          projetos (nome),
          categorias_financeiras (nome),
          contas (nome),
          fornecedores (nome)
        `);
      }

      if (tipo === "receitas") {
        query = query.order("data_recebimento", { ascending: false }).order("data_vencimento", { ascending: false });
      } else {
        query = query.order("data_pagamento", { ascending: false }).order("data_vencimento", { ascending: false });
      }

      if (dateFrom) {
        const start = startOfDay(dateFrom).toISOString();
        if (tipo === "receitas") {
          query = query.or(`data_recebimento.gte.${start},data_vencimento.gte.${start}`);
        } else {
          query = query.or(`data_pagamento.gte.${start},data_vencimento.gte.${start}`);
        }
      }

      if (dateTo) {
        const end = endOfDay(dateTo).toISOString();
        if (tipo === "receitas") {
          query = query.or(`data_recebimento.lte.${end},data_vencimento.lte.${end}`);
        } else {
          query = query.or(`data_pagamento.lte.${end},data_vencimento.lte.${end}`);
        }
      }

      query = query.range(page * pageLimit, page * pageLimit + pageLimit - 1);

      const { data, error } = await query;
      if (error) throw error;

      const chunk = data || [];
      all.push(...chunk);
      if (chunk.length < pageLimit) break;
      page += 1;
    }

    return all;
  };

  const generatePDF = (data: ReportRow[], title: string, filename: string) => {
    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(16);
    doc.text(title, 14, 16);

    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(
      `Período: ${dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Início"} a ${dateTo ? format(dateTo, "dd/MM/yyyy") : "Fim"}`,
      14,
      23
    );
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 29);

    const columns = Object.keys(data[0] || {});
    const tableData = data.map((row) =>
      columns.map((c) => {
        if (c === "Valor") return toCurrency(row.Valor);
        return String(row?.[c as keyof ReportRow] ?? "-");
      })
    );

    // Linha de total
    const totalValue = data.reduce((acc, r) => acc + (r.Valor ?? 0), 0);
    const totalRow = columns.map((col) => {
      if (col === "Tipo") return "TOTAL";
      if (col === "Valor") return toCurrency(totalValue);
      return "";
    });
    tableData.push(totalRow);

    autoTable(doc, {
      head: [columns],
      body: tableData,
      startY: 36,
      theme: "grid",
      headStyles: {
        fillColor: [249, 115, 22],
        textColor: 255,
        fontSize: 8,
        fontStyle: "bold",
      },
      styles: {
        fontSize: 7,
        cellPadding: 2,
        overflow: "linebreak",
      },
      didParseCell: (hookData) => {
        // Destaca a linha de total
        if (hookData.section === "body" && hookData.row.index === tableData.length - 1) {
          hookData.cell.styles.fontStyle = "bold";
          hookData.cell.styles.fillColor = [245, 245, 245];
        }
      },
    });

    doc.save(`${filename}.pdf`);
  };

  const getReportTypeLabel = (value: string) => {
    switch (value) {
      case "financeiro":
        return "Relatório Financeiro";
      case "receitas":
        return "Relatório de Receitas";
      case "despesas":
        return "Relatório de Despesas";
      default:
        return "Relatório";
    }
  };

  const getSuggestedTitle = () => {
    const base = getReportTypeLabel(tipoRelatorio);
    const period = `${dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Início"} a ${dateTo ? format(dateTo, "dd/MM/yyyy") : "Fim"}`;
    return `${base} • ${period}`;
  };

  const handleGerarRelatorio = async () => {
    if (!tipoRelatorio) {
      toast.error("Campos obrigatórios", { description: "Selecione o tipo de relatório" });
      return;
    }

    setIsLoading(true);
    clearAllFilters();

    try {
      let finalData: ReportRow[] = [];

      if (tipoRelatorio === "financeiro") {
        const [receitas, despesas] = await Promise.all([
          fetchFinancialData("receitas"),
          fetchFinancialData("despesas"),
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
        const data = await fetchFinancialData(tipoRelatorio as "receitas" | "despesas");
        finalData = processData(data || [], tipoRelatorio as "receitas" | "despesas");
      }

      if (finalData.length === 0) {
        toast.error("Sem dados", { description: "Não foram encontrados dados para os filtros selecionados." });
        setIsLoading(false);
        setReportData([]);
        setReportTitle("");
        return;
      }

      const title = getSuggestedTitle();
      setReportTitle(title);
      setReportData(finalData);

      toast.success("Relatório gerado", {
        description: `${finalData.length} registros carregados. Exporte em CSV ou PDF.`,
      });
    } catch (err: unknown) {
      toast.error("Erro ao gerar");
    } finally {
      setIsLoading(false);
    }
  };

  const applyPreset = (preset: "7d" | "this_month" | "last_month" | "30d" | "all" | "custom") => {
    setPeriodoPreset(preset);
    if (preset === "custom") return;
    const now = new Date();
    if (preset === "all") {
      setDateFrom(undefined);
      setDateTo(undefined);
      return;
    }
    if (preset === "7d") {
      setDateFrom(subDays(now, 6));
      setDateTo(now);
      return;
    }
    if (preset === "30d") {
      setDateFrom(subDays(now, 29));
      setDateTo(now);
      return;
    }
    if (preset === "this_month") {
      setDateFrom(startOfMonth(now));
      setDateTo(endOfMonth(now));
      return;
    }
    if (preset === "last_month") {
      const last = subMonths(now, 1);
      setDateFrom(startOfMonth(last));
      setDateTo(endOfMonth(last));
    }
  };

  const handleExport = async (formatType: "csv" | "pdf") => {
    if (!filteredData.length) {
      toast.error("Sem dados", { description: "Gere um relatório antes de exportar." });
      return;
    }

    try {
      setIsLoading(true);
      const filename = `relatorio-${tipoRelatorio || "geral"}-${format(new Date(), "yyyy-MM-dd")}`;
      const titleForPdf = reportTitle || getReportTypeLabel(tipoRelatorio) || "Relatório";

      if (formatType === "csv") {
        generateCSV(filteredData, filename);
      } else {
        generatePDF(filteredData, titleForPdf, filename);
      }

      toast.success("Exportação iniciada", { description: "O download deve iniciar automaticamente." });
    } catch (e: unknown) {
      toast.error("Erro ao exportar");
    } finally {
      setIsLoading(false);
    }
  };

  const tiposRelatorio = [
    { value: "financeiro", label: "Financeiro (Receitas e Despesas)" },
    { value: "receitas", label: "Receitas" },
    { value: "despesas", label: "Despesas" },
  ];

  // --- Render helpers ---

  const renderSummaryCards = () => {
    const showBoth =
      tipoRelatorio === "financeiro" ||
      (reportData.some((r) => r.Tipo === "Receita") && reportData.some((r) => r.Tipo === "Despesa"));

    return <RelatoriosSummary summary={summary} tipoRelatorio={tipoRelatorio} showBoth={showBoth} />;
  };

  const renderChart = () => {
    if (chartData.length < 2) return null;

    const hasBoth = tipoRelatorio === "financeiro";

    return (
      <div className="rounded-xl border border-black/5 bg-white p-4">
        <p className="text-sm font-medium text-black/70 mb-3">Evolução mensal</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) =>
                new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" }).format(v)
              }
            />
            <Tooltip
              formatter={(value: number) => toCurrency(value)}
              contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--chart-grid))" }}
            />
            {tipoRelatorio !== "despesas" && (
              <Bar dataKey="Receitas" fill="hsl(var(--chart-success-alt))" radius={[4, 4, 0, 0]} />
            )}
            {tipoRelatorio !== "receitas" && (
              <Bar dataKey="Despesas" fill="hsl(var(--chart-danger))" radius={[4, 4, 0, 0]} />
            )}
            {hasBoth && <Legend />}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderLoadingSkeleton = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[72px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[220px] rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-10 w-full rounded-lg" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-8 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );

  const renderEmptyState = () => (
    <EmptyState
      icon={FileBarChart}
      title="Nenhum relatório gerado"
      description='Selecione o tipo e período acima, depois clique em "Gerar relatório".'
    />
  );

  const renderStatusBadge = (status: string) => {
    const cfg = statusConfig[status];
    if (!cfg) return <span>{status}</span>;
    return (
      <Badge variant="outline" className={cn("text-[11px] font-medium", cfg.className)}>
        {cfg.label}
      </Badge>
    );
  };

  const renderTipoBadge = (tipo: string) => {
    const cfg = tipoConfig[tipo];
    if (!cfg) return <span>{tipo}</span>;
    return (
      <Badge variant="outline" className={cn("text-[11px] font-medium", cfg.className)}>
        {tipo}
      </Badge>
    );
  };

  const renderCellValue = (key: string, value: unknown) => {
    if (key === "Valor") return toCurrency(value as number);
    if (key === "Status") return renderStatusBadge(value as string);
    if (key === "Tipo") return renderTipoBadge(value as string);
    if (value === null || value === undefined) return "-";
    return String(value);
  };

  const renderFilterSelect = (value: string, onChange: (v: string) => void, options: string[], placeholder: string) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 text-xs bg-white">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((v) => (
          <SelectItem key={v} value={v}>
            {v}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <PageLayout
      containerClassName="h-full flex flex-col min-h-0"
      header={
        <PageHeader title="Relatórios" description="Monte, visualize e exporte relatórios financeiros">
          <Button
            onClick={gerarExecutivo}
            disabled={isExecutivoLoading}
            className="h-9 gap-1.5 bg-brand text-ink hover:bg-brand/90"
          >
            <Sparkles className="h-4 w-4" />
            {isExecutivoLoading ? "Gerando..." : "Relatório Executivo"}
          </Button>
        </PageHeader>
      }
    >
      <div className="flex-1 min-h-0 flex flex-col gap-5">
        {/* ═══ Barra de parâmetros ═══ */}
        <Card className="rounded-2xl border border-black/5 bg-white shrink-0">
          <CardContent className="p-5 space-y-4">
            {/* Linha 1: Tipo + Período + Botão */}
            <div className="flex flex-wrap gap-4 items-end">
              {/* Tipo */}
              <div className="space-y-1.5 w-56 shrink-0">
                <Label className="text-xs font-medium text-black/60">Tipo de relatório</Label>
                <Select value={tipoRelatorio} onValueChange={setTipoRelatorio}>
                  <SelectTrigger className="h-9 bg-white">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposRelatorio.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Período */}
              <div className="space-y-1.5 xl:w-48 shrink-0">
                <Label className="text-xs font-medium text-black/60">Período</Label>
                <Select value={periodoPreset} onValueChange={(v) => applyPreset(v as typeof periodoPreset)}>
                  <SelectTrigger className="h-9 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Últimos 7 dias</SelectItem>
                    <SelectItem value="30d">Últimos 30 dias</SelectItem>
                    <SelectItem value="this_month">Mês atual</SelectItem>
                    <SelectItem value="last_month">Mês anterior</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Datas customizadas (só aparecem quando "Personalizado") */}
              {periodoPreset === "custom" && (
                <div className="flex items-end gap-1.5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">De</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-9 text-xs gap-1.5 w-[130px] justify-start",
                            !dateFrom && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="h-3.5 w-3.5" />
                          {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Início"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateFrom}
                          onSelect={setDateFrom}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <span className="text-xs text-black/40 pb-2">até</span>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Até</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-9 text-xs gap-1.5 w-[130px] justify-start",
                            !dateTo && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="h-3.5 w-3.5" />
                          {dateTo ? format(dateTo, "dd/MM/yyyy") : "Fim"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateTo}
                          onSelect={setDateTo}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}

              {/* Botão gerar */}
              <Button
                onClick={handleGerarRelatorio}
                className="h-9 px-5 bg-brand hover:bg-brand/90 text-ink shrink-0"
                disabled={isLoading}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                {isLoading ? "Gerando..." : "Gerar relatório"}
              </Button>
            </div>

            {/* Linha 2: Filtros de coluna (aparecem após gerar) */}
            {reportData.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-3 border-t border-black/5">
                <div className="flex items-center gap-2 text-xs font-medium text-black/50 shrink-0">
                  <Filter size={13} />
                  Filtrar por:
                </div>
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {renderFilterSelect(filterCategoria, setFilterCategoria, filterOptions.categorias, "Categoria")}
                  {renderFilterSelect(filterCliente, setFilterCliente, filterOptions.clientes, "Cliente / Fornecedor")}
                  {renderFilterSelect(filterStatus, setFilterStatus, filterOptions.status, "Status")}
                  {renderFilterSelect(filterProjeto, setFilterProjeto, filterOptions.projetos, "Projeto")}
                  {renderFilterSelect(filterConta, setFilterConta, filterOptions.contas, "Conta")}
                </div>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-8 text-xs gap-1 shrink-0">
                    <X size={12} />
                    Limpar
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ Resultado ═══ */}
        <div className="flex-1 min-h-0 flex flex-col gap-5">
          {isLoading ? (
            renderLoadingSkeleton()
          ) : reportData.length === 0 ? (
            renderEmptyState()
          ) : (
            <>
              {/* Resumo + Gráfico lado a lado */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 shrink-0">
                <div className="lg:col-span-1 flex flex-col gap-3">{renderSummaryCards()}</div>
                <div className="lg:col-span-2">
                  {renderChart() ?? (
                    <div className="flex items-center justify-center h-full rounded-xl border border-black/5 bg-white text-sm text-black/30">
                      Dados insuficientes para gráfico
                    </div>
                  )}
                </div>
              </div>

              {/* Header da tabela com badge + export */}
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-medium text-black/70">Registros</h3>
                  <Badge variant="secondary" className="text-xs">
                    {filteredData.length} {hasActiveFilters ? `de ${reportData.length}` : ""}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                        <Columns3 size={13} />
                        Colunas
                        {visibleColumns.size < ALL_COLUMNS.length && (
                          <span className="text-[10px] bg-foreground text-background rounded-full px-1.5 py-0.5 min-w-[18px] tabular-nums">
                            {visibleColumns.size}
                          </span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-52 p-2" align="end">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between px-1 pb-1 border-b mb-1">
                          <span className="text-xs font-medium text-muted-foreground">Colunas visíveis</span>
                          <button
                            onClick={() => {
                              setVisibleColumns(new Set(ALL_COLUMNS));
                              localStorage.setItem("relatorios.columns", JSON.stringify(ALL_COLUMNS));
                            }}
                            className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-1"
                          >
                            Todas
                          </button>
                        </div>
                        {ALL_COLUMNS.map((col) => (
                          <label
                            key={col}
                            className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-muted cursor-pointer"
                          >
                            <Checkbox
                              checked={visibleColumns.has(col)}
                              onCheckedChange={() => toggleColumn(col)}
                              className="h-3.5 w-3.5"
                            />
                            <span className="text-xs">{col}</span>
                          </label>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => handleExport("csv")}
                    disabled={!filteredData.length}
                  >
                    <Download size={13} />
                    CSV
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1.5 bg-brand text-ink hover:bg-brand/90"
                    onClick={() => handleExport("pdf")}
                    disabled={!filteredData.length}
                  >
                    <Download size={13} />
                    PDF
                  </Button>
                </div>
              </div>

              {/* Tabela */}
              <div className="flex-1 min-h-0 w-full overflow-auto border rounded-xl bg-white">
                {(() => {
                  const cols = ALL_COLUMNS.filter((c) => visibleColumns.has(c));
                  const valorIdx = cols.indexOf("Valor");
                  return (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {cols.map((key) => (
                            <TableHead key={key} className="whitespace-nowrap text-xs">
                              {key}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={cols.length} className="text-center py-10 text-black/40 text-sm">
                              Nenhum registro encontrado com os filtros aplicados.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredData.map((row, idx) => (
                            <TableRow key={idx}>
                              {cols.map((key) => (
                                <TableCell key={key} className="align-top whitespace-nowrap text-xs">
                                  {renderCellValue(key, row[key as keyof ReportRow])}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                      {filteredData.length > 0 && valorIdx >= 0 && (
                        <TableFooter>
                          <TableRow className="bg-black/[0.02] font-semibold">
                            {cols.map((key, i) => (
                              <TableCell key={key} className="text-xs">
                                {i === 0 ? "Total" : i === valorIdx ? toCurrency(summary.total) : ""}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableFooter>
                      )}
                    </Table>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

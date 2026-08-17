import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { statusBadgeClasses, statusLabel } from "@/lib/status";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableCell } from "@/components/ui/table";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FiltroPeriodo } from "@/components/filters/FiltroPeriodo";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Download,
  FileBarChart,
  Filter,
  X,
  Columns3,
  FileSpreadsheet,
  FileText,
  FileDown,
  ChevronDown,
  Eye,
  Wallet,
  TrendingUp,
  TrendingDown,
  FolderKanban,
  Building2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { RelatoriosSummary } from "./relatorios/RelatoriosSummary";
import { useRelatorioData, parseDDMMYYYY, type ReportRow } from "./relatorios/useRelatorioData";
import { toCurrency, computeReportTotal, generateCSV, generatePDF, generateXLSX } from "./relatorios/relatorioExport";
import { applyFilters, computeFilterOptions, type ColumnFilters } from "./relatorios/relatorioFilters";

// recharts é pesado e esta é uma página secundária: só carrega o chunk do
// gráfico quando há dados suficientes para renderizá-lo (ver renderChart).
const RelatoriosChart = lazy(() => import("./relatorios/RelatoriosChart"));

// Relatório de rentabilidade: fluxo próprio (react-query + RPC agregada),
// carregado sob demanda só quando o usuário escolhe esse tipo.
const RelatoriosRentabilidade = lazy(() => import("./relatorios/RelatoriosRentabilidade"));

type RentabilidadeMode = "projeto" | "cliente";

// DataTable exige rowKey estável; ReportRow não tem id próprio (é linha
// derivada de agregação), então carimba o índice original em cada linha.
type IndexedReportRow = ReportRow & { __idx: number };

// Cores derivam do registry único (ADR 0008): "Pago" tem a MESMA cor em todas
// as telas. Mudar tom = src/lib/status.ts.
const finStatus = (s: string) => ({
  label: statusLabel("financeiro", s),
  className: statusBadgeClasses("financeiro", s),
});

const statusConfig: Record<string, { label: string; className: string }> = {
  Pendente: finStatus("Pendente"),
  Pago: finStatus("Pago"),
  Recebido: finStatus("Recebido"),
  Atrasado: finStatus("Atrasado"),
  Cancelado: finStatus("Cancelado"),
};

const tipoConfig: Record<string, { className: string }> = {
  Receita: { className: statusBadgeClasses("tipo", "Receita") },
  Despesa: { className: statusBadgeClasses("tipo", "Despesa") },
};

export default function Relatorios() {
  const [tipoRelatorio, setTipoRelatorio] = useState("");
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const { isLoading, setIsLoading, reportData, reportTitle, generateReport, clearReport } = useRelatorioData();
  const [rentabilidadeMode, setRentabilidadeMode] = useState<RentabilidadeMode | null>(null);

  const isRentabilidade = tipoRelatorio === "rentabilidade_projeto" || tipoRelatorio === "rentabilidade_cliente";

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

  const filters: ColumnFilters = {
    categoria: filterCategoria,
    cliente: filterCliente,
    status: filterStatus,
    projeto: filterProjeto,
    conta: filterConta,
  };

  const hasActiveFilters = !!(filterCategoria || filterCliente || filterStatus || filterProjeto || filterConta);

  const clearAllFilters = () => {
    setFilterCategoria("");
    setFilterCliente("");
    setFilterStatus("");
    setFilterProjeto("");
    setFilterConta("");
  };

  // Dados filtrados (todos os filtros aplicados)
  const filteredData = useMemo(
    () => applyFilters(reportData, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reportData, filterCategoria, filterCliente, filterStatus, filterProjeto, filterConta]
  );

  // Opções inteligentes: cada select mostra apenas valores compatíveis com os demais filtros
  const filterOptions = useMemo(
    () => computeFilterOptions(reportData, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reportData, filterCategoria, filterCliente, filterStatus, filterProjeto, filterConta]
  );

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

  const getReportTypeLabel = (value: string) => {
    switch (value) {
      case "financeiro":
        return "Relatório Financeiro";
      case "receitas":
        return "Relatório de Receitas";
      case "despesas":
        return "Relatório de Despesas";
      case "rentabilidade_projeto":
        return "Rentabilidade por projeto";
      case "rentabilidade_cliente":
        return "Rentabilidade por cliente";
      default:
        return "Relatório";
    }
  };

  const getSuggestedTitle = (tipo: string) => {
    const base = getReportTypeLabel(tipo);
    const period = `${dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Início"} a ${dateTo ? format(dateTo, "dd/MM/yyyy") : "Fim"}`;
    return `${base} • ${period}`;
  };

  // Gera a PRÉVIA do relatório na tela (tabela + resumo). Não baixa nada: o
  // download é o passo seguinte, no botão Exportar.
  const gerarRelatorio = async (tipo: string) => {
    if (!tipo) {
      toast.error("Selecione um tipo", { description: "Escolha o tipo de relatório para ver a prévia." });
      return;
    }

    // Rentabilidade tem fluxo próprio (componente com react-query): não passa
    // pelo pipeline financeiro de receitas/despesas.
    if (tipo === "rentabilidade_projeto" || tipo === "rentabilidade_cliente") {
      clearReport();
      setRentabilidadeMode(tipo === "rentabilidade_cliente" ? "cliente" : "projeto");
      return;
    }

    setRentabilidadeMode(null);
    clearAllFilters();

    await generateReport({ tipoRelatorio: tipo, dateFrom, dateTo, title: getSuggestedTitle(tipo) });
  };

  const handleGerarRelatorio = () => gerarRelatorio(tipoRelatorio);

  // Card do estado inicial: seleciona o tipo e já mostra a prévia, num clique.
  const escolherTipo = (tipo: string) => {
    setTipoRelatorio(tipo);
    void gerarRelatorio(tipo);
  };


  const handleExport = async (formatType: "csv" | "xlsx" | "pdf") => {
    if (!filteredData.length) {
      toast.error("Sem dados", { description: "Gere um relatório antes de exportar." });
      return;
    }

    try {
      setIsLoading(true);
      const filename = `relatorio-${tipoRelatorio || "geral"}-${format(new Date(), "yyyy-MM-dd")}`;
      const titleForPdf = reportTitle || getReportTypeLabel(tipoRelatorio) || "Relatório";
      // Exporta só as colunas visíveis, na ordem canônica: o que se vê é o que se exporta.
      const columns = ALL_COLUMNS.filter((c) => visibleColumns.has(c));

      if (formatType === "csv") {
        generateCSV(filteredData, columns, filename);
      } else if (formatType === "xlsx") {
        await generateXLSX(filteredData, columns, filename);
      } else {
        await generatePDF(filteredData, columns, { title: titleForPdf, filename, dateFrom, dateTo });
      }

      toast.success("Exportação iniciada", { description: "O download deve iniciar automaticamente." });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("Erro ao exportar relatório:", e);
      toast.error("Erro ao exportar", { description: message });
    } finally {
      setIsLoading(false);
    }
  };

  const tiposRelatorio = [
    {
      value: "financeiro",
      label: "Financeiro (Receitas e Despesas)",
      cardLabel: "Financeiro",
      icon: Wallet,
      hint: "Receitas e despesas do período, com saldo",
    },
    {
      value: "receitas",
      label: "Receitas",
      cardLabel: "Receitas",
      icon: TrendingUp,
      hint: "Só as entradas do período",
    },
    {
      value: "despesas",
      label: "Despesas",
      cardLabel: "Despesas",
      icon: TrendingDown,
      hint: "Só as saídas do período",
    },
    {
      value: "rentabilidade_projeto",
      label: "Rentabilidade por projeto",
      cardLabel: "Rentabilidade por projeto",
      icon: FolderKanban,
      hint: "Margem de cada projeto",
    },
    {
      value: "rentabilidade_cliente",
      label: "Rentabilidade por cliente",
      cardLabel: "Rentabilidade por cliente",
      icon: Building2,
      hint: "Margem por cliente",
    },
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

    return (
      <Suspense fallback={<Skeleton className="h-[220px] rounded-xl" />}>
        <RelatoriosChart chartData={chartData} tipoRelatorio={tipoRelatorio} />
      </Suspense>
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
    <div className="flex flex-col items-center text-center py-6 px-4">
      <div className="mb-3 rounded-full bg-brand/15 p-3">
        <FileBarChart className="h-6 w-6 text-ink" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-ink mb-1">Escolha um relatório para começar</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        Clique num tipo para ver a prévia na tela. Depois você exporta em Excel, CSV ou PDF.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-3xl">
        {tiposRelatorio.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => escolherTipo(t.value)}
              className="group flex flex-col items-start gap-2 rounded-2xl border border-black/5 bg-white p-4 text-left transition-all hover:border-brand hover:bg-brand/5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/15 text-ink transition-colors group-hover:bg-brand">
                <Icon size={17} strokeWidth={1.7} />
              </span>
              <span className="text-sm font-medium text-ink">{t.cardLabel}</span>
              <span className="text-xs text-muted-foreground leading-snug">{t.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
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

  const rowsWithIndex: IndexedReportRow[] = filteredData.map((row, idx) => ({ ...row, __idx: idx }));

  const reportColumns: ColumnDef<IndexedReportRow>[] = ALL_COLUMNS.map((key) => ({
    key,
    header: key,
    className: "whitespace-nowrap text-xs align-top",
    cell: (row) => renderCellValue(key, row[key]),
  }));

  const reportColumnVisibility: Record<string, boolean> = Object.fromEntries(
    ALL_COLUMNS.map((c) => [c, visibleColumns.has(c)])
  );

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
    <div className="flex flex-col gap-5">
      {/* ═══ Barra de parâmetros ═══ */}
      <Card className="rounded-2xl border border-black/5 bg-white shrink-0">
        <CardContent className="p-5 space-y-4">
          {/* Linha 1: Tipo + Período + Botão */}
          <div className="flex flex-wrap gap-4 items-end">
            {/* Tipo */}
            <div className="space-y-1.5 w-56 shrink-0">
              <Label className="text-xs font-medium text-muted-foreground">Tipo de relatório</Label>
              <Select
                value={tipoRelatorio}
                onValueChange={(v) => {
                  setTipoRelatorio(v);
                  setRentabilidadeMode(null);
                }}
              >
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

            {/* Período (não se aplica a rentabilidade, que é acumulada por projeto) */}
            {!isRentabilidade && (
              <div className="space-y-1.5 shrink-0">
                <Label className="text-xs font-medium text-muted-foreground">Período</Label>
                <div>
                  <FiltroPeriodo
                    from={dateFrom}
                    to={dateTo}
                    onChange={(from, to) => {
                      setDateFrom(from);
                      setDateTo(to);
                    }}
                    presets={[
                      "mes-atual",
                      "mes-anterior",
                      "ultimos-7",
                      "ultimos-30",
                      "este-trimestre",
                      "trimestre-passado",
                      "este-ano",
                      "tudo",
                      "custom",
                    ]}
                    align="start"
                  />
                </div>
              </div>
            )}

            {/* Botão gerar prévia (não baixa; exportar é passo separado) */}
            <Button onClick={handleGerarRelatorio} variant="brand" className="h-9 px-5 shrink-0" disabled={isLoading}>
              <Eye className="mr-1.5 h-4 w-4" />
              {isLoading ? "Gerando..." : "Gerar prévia"}
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
      <div className="flex flex-col gap-5">
        {rentabilidadeMode ? (
          <Suspense fallback={renderLoadingSkeleton()}>
            <RelatoriosRentabilidade modo={rentabilidadeMode} />
          </Suspense>
        ) : isLoading ? (
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
                <h3 className="text-sm font-medium text-muted-foreground">Registros</h3>
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
                        <span className="text-[10px] bg-brand text-ink rounded-full px-1.5 py-0.5 min-w-[18px] tabular-nums">
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
                          className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-brand/10 cursor-pointer"
                        >
                          <Checkbox
                            checked={visibleColumns.has(col)}
                            onCheckedChange={() => toggleColumn(col)}
                            className="h-3.5 w-3.5 data-[state=checked]:bg-brand data-[state=checked]:text-ink data-[state=checked]:border-brand"
                          />
                          <span className="text-xs">{col}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="brand" className="h-8 text-xs gap-1.5" disabled={!filteredData.length}>
                      <Download size={13} />
                      Exportar
                      <ChevronDown size={13} className="opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[176px]">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Baixar como</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleExport("xlsx")} className="text-sm">
                      <FileSpreadsheet size={14} className="mr-2" />
                      Excel (.xlsx)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("csv")} className="text-sm">
                      <FileText size={14} className="mr-2" />
                      CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("pdf")} className="text-sm">
                      <FileDown size={14} className="mr-2" />
                      PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Tabela */}
            <div className="w-full border rounded-xl bg-white" style={{ minHeight: "320px" }}>
              <DataTable
                columns={reportColumns}
                columnVisibility={reportColumnVisibility}
                data={{ rows: rowsWithIndex }}
                rowKey={(row) => String(row.__idx)}
                maxHeight="60vh"
                emptyMessage="Nenhum registro encontrado com os filtros aplicados."
                footer={
                  visibleColumns.has("Valor")
                    ? (cols) => {
                        const footerTotal = computeReportTotal(filteredData);
                        const valorIdx = cols.findIndex((c) => c.key === "Valor");
                        return cols.map((c, i) => (
                          <TableCell key={c.key} className="text-xs">
                            {i === 0 ? footerTotal.label : i === valorIdx ? toCurrency(footerTotal.value) : ""}
                          </TableCell>
                        ));
                      }
                    : undefined
                }
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

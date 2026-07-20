import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Download, Plus, FileBarChart, Filter, X, Columns3 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { usePageTitle } from "@/hooks/usePageTitle";
import { RelatoriosSummary } from "./relatorios/RelatoriosSummary";
import { useRelatorioData, parseDDMMYYYY, type ReportRow } from "./relatorios/useRelatorioData";
import { toCurrency, computeReportTotal, generateCSV, generatePDF } from "./relatorios/relatorioExport";
import { applyFilters, computeFilterOptions, type ColumnFilters } from "./relatorios/relatorioFilters";

// recharts é pesado e esta é uma página secundária: só carrega o chunk do
// gráfico quando há dados suficientes para renderizá-lo (ver renderChart).
const RelatoriosChart = lazy(() => import("./relatorios/RelatoriosChart"));

// Relatório de rentabilidade: fluxo próprio (react-query + RPC agregada),
// carregado sob demanda só quando o usuário escolhe esse tipo.
const RelatoriosRentabilidade = lazy(() => import("./relatorios/RelatoriosRentabilidade"));

type RentabilidadeMode = "projeto" | "cliente";

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

export default function Relatorios() {
  usePageTitle("Relatórios");
  const [tipoRelatorio, setTipoRelatorio] = useState("");
  const [periodoPreset, setPeriodoPreset] = useState<"7d" | "30d" | "this_month" | "last_month" | "all" | "custom">(
    "all"
  );
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

    // Rentabilidade tem fluxo próprio (componente com react-query): não passa
    // pelo pipeline financeiro de receitas/despesas.
    if (isRentabilidade) {
      clearReport();
      setRentabilidadeMode(tipoRelatorio === "rentabilidade_cliente" ? "cliente" : "projeto");
      return;
    }

    setRentabilidadeMode(null);
    clearAllFilters();

    await generateReport({ tipoRelatorio, dateFrom, dateTo, title: getSuggestedTitle() });
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
      // Exporta só as colunas visíveis, na ordem canônica: o que se vê é o que se exporta.
      const columns = ALL_COLUMNS.filter((c) => visibleColumns.has(c));

      if (formatType === "csv") {
        generateCSV(filteredData, columns, filename);
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
    { value: "financeiro", label: "Financeiro (Receitas e Despesas)" },
    { value: "receitas", label: "Receitas" },
    { value: "despesas", label: "Despesas" },
    { value: "rentabilidade_projeto", label: "Rentabilidade por projeto" },
    { value: "rentabilidade_cliente", label: "Rentabilidade por cliente" },
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
      header={<PageHeader title="Relatórios" description="Monte, visualize e exporte relatórios financeiros" />}
    >
      <div className="flex-1 overflow-y-auto flex flex-col gap-5 pb-6">
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
              <div className="space-y-1.5 xl:w-48 shrink-0">
                <Label className="text-xs font-medium text-muted-foreground">Período</Label>
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
              )}

              {/* Datas customizadas (só aparecem quando "Personalizado") */}
              {!isRentabilidade && periodoPreset === "custom" && (
                <div className="flex items-end gap-1.5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">De</Label>
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
                  <span className="text-xs text-muted-foreground pb-2">até</span>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Até</Label>
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
              <div
                className="flex-1 min-h-0 w-full overflow-auto border rounded-xl bg-white"
                style={{ minHeight: "320px" }}
              >
                {(() => {
                  const cols = ALL_COLUMNS.filter((c) => visibleColumns.has(c));
                  const valorIdx = cols.indexOf("Valor");
                  const footerTotal = computeReportTotal(filteredData);
                  return (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {cols.map((key) => (
                            <TableHead
                              key={key}
                              className="whitespace-nowrap text-xs sticky top-0 z-10 bg-white"
                            >
                              {key}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredData.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={cols.length}
                              className="text-center py-10 text-muted-foreground text-sm"
                            >
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
                                {i === 0 ? footerTotal.label : i === valorIdx ? toCurrency(footerTotal.value) : ""}
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

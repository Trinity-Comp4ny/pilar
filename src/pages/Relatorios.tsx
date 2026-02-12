import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Download, Plus } from "lucide-react";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { getDisplayDate, formatDateDisplay } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function Relatorios() {
  const [tipoRelatorio, setTipoRelatorio] = useState("");
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [reportData, setReportData] = useState<any[]>([]);
  const [reportTitle, setReportTitle] = useState<string>("");

  const toCurrency = (value: any) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(n);
  };

  const processData = (data: any[], tipo: "receitas" | "despesas") => {
    return (data || []).map((item) => ({
      Tipo: tipo === "receitas" ? "Receita" : "Despesa",
      Descricao: item.descricao ?? "-",
      Valor: item.valor ?? 0,
      "Data": formatDateDisplay(getDisplayDate(
        tipo === "receitas" ? item.data_recebimento : item.data_pagamento,
        item.data_vencimento,
        item.status
      )) || "-",
      Status: item.status ?? "-",
      "Nome do Projeto": item.projetos?.nome ?? "-",
      "Nome do Cliente": tipo === "receitas" ? (item.clientes?.nome ?? "-") : (item.fornecedores?.nome ?? "-"),
      Categoria: item.categorias_financeiras?.nome ?? "-",
      Conta: item.contas?.nome ?? "-",
    }));
  };

  const generateCSV = (data: any[], filename: string) => {
    if (!data.length) {
      toast({
        title: "Sem dados",
        description: "Não há dados para exportar.",
        variant: "destructive",
      });
      return;
    }

    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((row) =>
      Object.values(row)
        .map((value) => {
          const str = value === null || value === undefined ? "" : String(value);
          return str.includes(",") ? `"${str.replace(/\"/g, '""')}"` : str;
        })
        .join(",")
    );

    const csvContent = [headers, ...rows].join("\n");
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

  const fetchFinancialData = async (tipo: 'receitas' | 'despesas') => {
    const pageLimit = 1000;
    let page = 0;
    const all: any[] = [];

    while (true) {
      let query = supabase.from(tipo).select(`
        *,
        projetos (nome),
        categorias_financeiras (nome),
        contas (nome)
      `);

      if (tipo === 'receitas') {
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

      // Para receitas: ordenar por data_recebimento (real) primeiro, depois data_vencimento (planejado)
      // Para despesas: ordenar por data_pagamento (real) primeiro, depois data_vencimento (planejado)
      if (tipo === "receitas") {
        query = query.order("data_recebimento", { ascending: false })
          .order("data_vencimento", { ascending: false });
      } else {
        query = query.order("data_pagamento", { ascending: false })
          .order("data_vencimento", { ascending: false });
      }

      // Filtros por período baseados na lógica de datas
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

  const generatePDF = (data: any[], title: string, filename: string) => {
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
    const tableData = data.map((row) => columns.map((c) => String(row?.[c] ?? "-")));

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
      toast({
        title: "Campos obrigatórios",
        description: "Selecione o tipo de relatório",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      let finalData: any[] = [];

      if (tipoRelatorio === 'financeiro') {
        const [receitas, despesas] = await Promise.all([
          fetchFinancialData('receitas'),
          fetchFinancialData('despesas')
        ]);
        
        const receitasProc = processData(receitas || [], 'receitas');
        const despesasProc = processData(despesas || [], 'despesas');
        finalData = [...receitasProc, ...despesasProc];
        
        // Ordenar por data correta (data real para pagos/recebidos, data planejada para pendentes)
        finalData.sort((a, b) => {
           // Parse da data no formato dd/MM/yyyy para comparar
           const parseDate = (str: string) => {
             if(str === '-') return 0;
             const [d, m, y] = str.split('/').map(Number);
             return new Date(y, m-1, d).getTime();
           };
           return parseDate(b['Data']) - parseDate(a['Data']);
        });

      } else if (['receitas', 'despesas'].includes(tipoRelatorio)) {
         const data = await fetchFinancialData(tipoRelatorio as 'receitas' | 'despesas');
         finalData = processData(data || [], tipoRelatorio as 'receitas' | 'despesas');
      }

      if (finalData.length === 0) {
        toast({
          title: "Sem dados",
          description: "Não foram encontrados dados para os filtros selecionados.",
          variant: "destructive"
        });
        setIsLoading(false);
        setReportData([]);
        setReportTitle("");
        return;
      }

      const title = getSuggestedTitle();
      setReportTitle(title);
      setReportData(finalData);

      toast({
        title: "Relatório gerado",
        description: "Pré-visualização carregada. Agora você pode exportar em CSV ou PDF.",
      });
    } catch (error: any) {
      console.error("Erro ao gerar relatório:", error);
      toast({
        title: "Erro ao gerar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const applyPreset = (preset: "7d" | "this_month" | "last_month" | "30d" | "all") => {
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

  const resetBuilder = () => {
    setTipoRelatorio("");
    setDateFrom(undefined);
    setDateTo(undefined);
    setReportData([]);
    setReportTitle("");
  };

  const handleExport = async (formatType: "csv" | "pdf") => {
    if (!reportData.length) {
      toast({
        title: "Sem dados",
        description: "Gere um relatório antes de exportar.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const filename = `relatorio-${tipoRelatorio || "geral"}-${format(new Date(), "yyyy-MM-dd")}`;
      const titleForPdf = reportTitle || getReportTypeLabel(tipoRelatorio) || "Relatório";

      if (formatType === "csv") {
        generateCSV(reportData, filename);
      } else {
        generatePDF(reportData, titleForPdf, filename);
      }

      toast({
        title: "Exportação iniciada",
        description: "O download deve iniciar automaticamente.",
      });
    } catch (e: any) {
      console.error("Erro ao exportar:", e);
      toast({
        title: "Erro ao exportar",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const tiposRelatorio = [
    { value: "financeiro", label: "Financeiro (Receitas e Despesas)" },
    { value: "receitas", label: "Receitas" },
    { value: "despesas", label: "Despesas" },
  ];

  return (
    <PageLayout
      className="overflow-y-hidden"
      containerClassName="h-full flex flex-col min-h-0"
      header={
        <PageHeader
          title="Relatórios"
          description="Monte, visualize e exporte relatórios em poucos cliques"
        />
      }
    >
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6 min-h-0">
          <Card className="rounded-2xl border border-black/5 bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-medium tracking-tight">Construtor</CardTitle>
              <CardDescription className="text-sm text-black/60 mt-1">
                Escolha um tipo, defina o período e gere a prévia.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">
                  {tiposRelatorio.map((tipo) => (
                    <button
                      key={tipo.value}
                      type="button"
                      onClick={() => setTipoRelatorio(tipo.value)}
                      className={cn(
                        "text-left rounded-xl border px-4 py-3 transition-colors",
                        tipoRelatorio === tipo.value
                          ? "border-accent-orange bg-accent-orange/5"
                          : "border-black/10 hover:bg-black/5"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{tipo.label}</div>
                          <div className="text-xs text-black/50 mt-1">Prévia + exportação (CSV/PDF)</div>
                        </div>
                        {tipoRelatorio === tipo.value && (
                          <Badge className="bg-accent-orange text-white">Selecionado</Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Período</Label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => applyPreset("7d")}>Últimos 7 dias</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => applyPreset("30d")}>Últimos 30 dias</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => applyPreset("this_month")}>Mês atual</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => applyPreset("last_month")}>Mês anterior</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => applyPreset("all")}>Sem filtro</Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data início</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Selecionar"}
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

                <div className="space-y-2">
                  <Label>Data fim</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "dd/MM/yyyy") : "Selecionar"}
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

              <Button
                onClick={handleGerarRelatorio}
                className="w-full bg-accent-orange hover:bg-accent-orange/90 text-white"
                disabled={isLoading}
              >
                <Plus className="mr-2 h-4 w-4" />
                {isLoading ? "Gerando..." : "Gerar pré-visualização"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 min-h-0 flex flex-col">
          <Card className="rounded-2xl border border-black/5 bg-white w-full flex flex-col min-h-0">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="text-lg font-medium tracking-tight">Pré-visualização</CardTitle>
                  <CardDescription className="text-sm text-black/60 mt-1">
                    {reportTitle ? reportTitle : "Gere uma prévia para visualizar os dados antes de exportar."}
                  </CardDescription>
                </div>

                {reportData.length > 0 && (
                  <Badge variant="secondary" className="shrink-0">
                    {reportData.length} registros
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex-1 min-h-0">
              {isLoading ? (
                <div className="text-center text-gray-500 py-10">Carregando prévia...</div>
              ) : reportData.length === 0 ? (
                <div className="text-center text-gray-500 py-10">Sem prévia carregada.</div>
              ) : (
                <div className="flex flex-col gap-3 min-h-0">
                  <div className="w-full overflow-auto max-h-[calc(100svh-320px)] border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(reportData[0] || {}).map((key) => (
                            <TableHead key={key} className="whitespace-nowrap">{key}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.map((row, idx) => (
                          <TableRow key={idx}>
                            {Object.keys(reportData[0] || {}).map((key) => (
                              <TableCell key={key} className="align-top whitespace-nowrap">
                                {key === "Valor"
                                  ? toCurrency(row?.[key])
                                  : row?.[key] === null || row?.[key] === undefined
                                    ? "-"
                                    : String(row[key])}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() => handleExport("csv")}
                      disabled={isLoading || !reportData.length}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      CSV
                    </Button>

                    <Button
                      className="rounded-full bg-accent-orange text-white hover:bg-accent-orange/90"
                      onClick={() => handleExport("pdf")}
                      disabled={isLoading || !reportData.length}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      PDF
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}

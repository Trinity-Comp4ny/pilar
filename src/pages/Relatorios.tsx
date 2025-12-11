import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarIcon, Download, Plus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function Relatorios() {
  const [tipoRelatorio, setTipoRelatorio] = useState("");
  const [formato, setFormato] = useState("");
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name, email');
      const map: Record<string, string> = {};
      if (profiles) {
        profiles.forEach((p: any) => {
           const name = p.first_name ? `${p.first_name} ${p.last_name || ''}`.trim() : p.email;
           map[p.id] = name;
        });
      }
      setProfilesMap(map);
    } catch (e) {
      console.error("Erro ao carregar perfis:", e);
    }
  };

  const getUserName = (id: string) => {
    if (!id) return "-";
    return profilesMap[id] || id;
  };

  const fetchFinancialData = async (tipo: 'receitas' | 'despesas') => {
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

    if (dateFrom) {
      query = query.gte('data_vencimento', dateFrom.toISOString());
    }
    
    if (dateTo) {
      query = query.lte('data_vencimento', dateTo.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  };

  const processData = (data: any[], tipo: 'receitas' | 'despesas') => {
    return data.map(item => ({
      'Descricao': item.descricao,
      'Valor': item.valor,
      'Data Vencimento': item.data_vencimento ? format(new Date(item.data_vencimento), 'dd/MM/yyyy') : '-',
      'Data Recebimento': item.data_recebimento || item.data_pagamento ? format(new Date(item.data_recebimento || item.data_pagamento), 'dd/MM/yyyy') : '-',
      'Status': item.status,
      'Nome do Projeto': item.projetos?.nome || '-',
      'Nome do Cliente': tipo === 'receitas' ? (item.clientes?.nome || '-') : (item.fornecedores?.nome || '-'),
      'Categoria': item.categorias_financeiras?.nome || '-',
      'Conta': item.contas?.nome || '-',
      'Nota Fiscal': item.nota_fiscal || '-',
      'Observacao': item.observacao || '-',
      'Criado por': getUserName(item.created_by),
      'Updated por': getUserName(item.updated_by),
      'Create at': item.created_at ? format(new Date(item.created_at), 'dd/MM/yyyy HH:mm') : '-',
      'Updated at': item.updated_at ? format(new Date(item.updated_at), 'dd/MM/yyyy HH:mm') : '-',
      'Forma Pagamento': item.forma_pagamento || '-',
    }));
  };

  // Function to draw Pilar logo using vector lines (based on SVG)
  const drawPilarLogo = (doc: jsPDF, x: number, y: number, scale: number = 1.0) => {
    doc.setDrawColor(10, 10, 10); // #0A0A0A
    doc.setLineWidth(1.6 * scale);
    doc.setLineCap("round");

    // Capital (top line)
    doc.line(x + (1 * scale), y + (2 * scale), x + (27 * scale), y + (2 * scale));
    
    // Abacus (subtle line) - make it lighter manually or just draw
    const originalColor = doc.getDrawColor();
    doc.setDrawColor(100, 100, 100); 
    doc.line(x + (3 * scale), y + (6 * scale), x + (25 * scale), y + (6 * scale));
    doc.setDrawColor(10, 10, 10); // Reset

    // Flutes (shaft)
    doc.line(x + (7 * scale), y + (9 * scale), x + (7 * scale), y + (23 * scale));
    doc.line(x + (12 * scale), y + (9 * scale), x + (12 * scale), y + (23 * scale));
    doc.line(x + (17 * scale), y + (9 * scale), x + (17 * scale), y + (23 * scale));
    doc.line(x + (22 * scale), y + (9 * scale), x + (22 * scale), y + (23 * scale));
  };

  const generatePDF = (data: any[], title: string) => {
    const doc = new jsPDF();

    // --- CAPA ---
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 210, 297, 'F');
    
    // Top Bar
    doc.setFillColor(249, 115, 22); // Orange
    doc.rect(0, 0, 210, 15, 'F');
    
    // Bottom Bar
    doc.rect(0, 282, 210, 15, 'F');

    // Logo Centered Big
    const centerX = 105;
    const centerY = 100;
    // Draw scaled up logo (approx 64x64) - base is ~32x32, so scale 2
    // Adjust x/y to center. Base width 28, height 24 roughly.
    drawPilarLogo(doc, centerX - 14*2, centerY - 12*2, 2);

    // Title
    doc.setFontSize(24);
    doc.setTextColor(33, 33, 33);
    doc.text("RELATÓRIO FINANCEIRO", 105, centerY + 40, { align: "center" });
    
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text(`Período: ${dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Início'} a ${dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Fim'}`, 105, centerY + 55, { align: "center" });
    
    doc.setFontSize(12);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 105, centerY + 65, { align: "center" });

    doc.setFontSize(12);
    doc.setTextColor(249, 115, 22);
    doc.text("Pilar - Gestão de Engenharia", 105, 275, { align: "center" });

    // --- PÁGINAS DE DADOS ---
    doc.addPage();
    
    const columns = Object.keys(data[0]);
    
    // Prepare table data
    const tableData = data.map(row => Object.values(row));

    // Page styling function
    const didDrawPage = (data: any) => {
        // Logo on top right corner
        // 210 width. Margin right 14. 
        // Draw small logo scale 0.5
        drawPilarLogo(doc, 210 - 25, 10, 0.5);
        
        // Page number
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(`Página ${doc.getNumberOfPages()}`, data.settings.margin.left, pageHeight - 10);
    };

    autoTable(doc, {
      head: [columns],
      body: tableData,
      startY: 25,
      theme: 'grid',
      headStyles: { 
        fillColor: [249, 115, 22], 
        textColor: 255,
        fontSize: 7,
        fontStyle: 'bold'
      },
      styles: { 
        fontSize: 6,
        cellPadding: 2,
        overflow: 'linebreak'
      },
      columnStyles: {
        0: { cellWidth: 25 }, // Descricao
        1: { cellWidth: 15 }, // Valor
        2: { cellWidth: 15 }, // Vencimento
        // Adjust others automatically
      },
      didDrawPage: didDrawPage,
      margin: { top: 25 }
    });

    doc.save(`${title}.pdf`);
  };

  const generateCSV = (data: any[], filename: string) => {
    if (!data.length) {
      toast({
        title: "Sem dados",
        description: "Não há dados para o período selecionado",
        variant: "destructive",
      });
      return;
    }

    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(row => 
      Object.values(row).map(value => 
        typeof value === 'string' && value.includes(',') ? `"${value}"` : value
      ).join(",")
    );
    const csvContent = [headers, ...rows].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGerarRelatorio = async () => {
    if (!tipoRelatorio || !formato) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione o tipo de relatório e formato",
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
        
        // Ordenar por data de vencimento (descrescente)
        finalData.sort((a, b) => {
           // Need to parse 'dd/MM/yyyy' to compare
           const parseDate = (str: string) => {
             if(str === '-') return 0;
             const [d, m, y] = str.split('/').map(Number);
             return new Date(y, m-1, d).getTime();
           };
           return parseDate(b['Data Vencimento']) - parseDate(a['Data Vencimento']);
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
        return;
      }

      if (formato === 'csv') {
        generateCSV(finalData, `relatorio-${tipoRelatorio}-${format(new Date(), 'yyyy-MM-dd')}`);
      } else if (formato === 'pdf') {
        generatePDF(finalData, `relatorio-${tipoRelatorio}-${format(new Date(), 'yyyy-MM-dd')}`);
      }

      toast({
        title: "Relatório gerado",
        description: "O download deve iniciar automaticamente",
      });

      setIsDialogOpen(false);
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

  const tiposRelatorio = [
    { value: "financeiro", label: "Financeiro (Receitas e Despesas)" },
    { value: "receitas", label: "Receitas" },
    { value: "despesas", label: "Despesas" },
  ];

  return (
    <PageLayout
      header={
        <PageHeader 
          title="Relatórios" 
          description="Gere e gerencie seus relatórios"
          children={
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full bg-accent-orange text-white hover:bg-accent-orange/90 transition-colors px-5 py-2.5 text-sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Relatório
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Gerar Relatório</DialogTitle>
                  <DialogDescription>
                    Configure e gere relatórios personalizados
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="tipoRelatorio">Tipo de Relatório</Label>
                    <Select value={tipoRelatorio} onValueChange={setTipoRelatorio}>
                      <SelectTrigger>
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

                  <div className="space-y-2">
                    <Label htmlFor="formato">Formato</Label>
                    <Select value={formato} onValueChange={setFormato}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o formato" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="csv">CSV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data Início</Label>
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
                      <Label>Data Fim</Label>
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
                    className="w-full bg-accent-orange hover:bg-accent-orange/90 text-white mt-4"
                    disabled={isLoading}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {isLoading ? "Gerando..." : "Gerar e Baixar"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          }
        />
      }
    >
      <Card className="rounded-2xl border border-black/5 bg-white w-full">
        <CardHeader>
          <CardTitle className="text-lg font-medium tracking-tight">Histórico de Relatórios</CardTitle>
          <CardDescription className="text-sm text-black/60 mt-1">
            Histórico não disponível (Geração sob demanda)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            Gere um novo relatório para baixar os dados.
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  );
}

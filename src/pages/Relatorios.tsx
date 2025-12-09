import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarIcon, FileText, Download, Plus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";

export default function Relatorios() {
  const [tipoRelatorio, setTipoRelatorio] = useState("");
  const [formato, setFormato] = useState("");
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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

    if (formato !== 'csv') {
      toast({
        title: "Formato não suportado",
        description: "No momento apenas CSV está disponível",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      let query = (supabase.from(tipoRelatorio === 'funcionarios' ? 'pessoas' : tipoRelatorio) as any).select('*');

      if (dateFrom) {
        // Assuming generic created_at for simplicity, or specific date fields for financial
        const dateField = ['receitas', 'despesas'].includes(tipoRelatorio) ? 'data_vencimento' : 'created_at';
        query = query.gte(dateField, dateFrom.toISOString());
      }
      
      if (dateTo) {
        const dateField = ['receitas', 'despesas'].includes(tipoRelatorio) ? 'data_vencimento' : 'created_at';
        query = query.lte(dateField, dateTo.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      generateCSV(data || [], `relatorio-${tipoRelatorio}-${format(new Date(), 'yyyy-MM-dd')}`);

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
    { value: "receitas", label: "Receitas" },
    { value: "despesas", label: "Despesas" },
    { value: "projetos", label: "Projetos" },
    { value: "clientes", label: "Clientes" },
    { value: "funcionarios", label: "Pessoas" },
    { value: "leads", label: "Leads" },
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
                <Button className="rounded-full bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))]/90 transition-colors px-5 py-2.5 text-sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Relatório
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Gerar Relatório</DialogTitle>
                  <DialogDescription>
                    Configure e gere relatórios personalizados (CSV)
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
                        {/* <SelectItem value="pdf">PDF</SelectItem> */}
                        <SelectItem value="csv">CSV</SelectItem>
                        {/* <SelectItem value="xlsx">Excel (XLSX)</SelectItem> */}
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
                    className="w-full vrz-button-primary mt-4"
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
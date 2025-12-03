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

export default function Relatorios() {
  const [tipoRelatorio, setTipoRelatorio] = useState("");
  const [formato, setFormato] = useState("");
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleGerarRelatorio = () => {
    if (!tipoRelatorio || !formato) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione o tipo de relatório e formato",
        variant: "destructive",
      });
      return;
    }

    // Simulação de geração de relatório
    toast({
      title: "Relatório gerado com sucesso!",
      description: `Relatório de ${tipoRelatorio} em formato ${formato.toUpperCase()} foi gerado`,
    });

    setIsDialogOpen(false);
  };

  const tiposRelatorio = [
    { value: "receitas", label: "Receitas" },
    { value: "despesas", label: "Despesas" },
    { value: "projetos", label: "Projetos" },
    { value: "clientes", label: "Clientes" },
    { value: "funcionarios", label: "Pessoas" },
    { value: "financeiro-completo", label: "Financeiro Completo" },
    { value: "fluxo-caixa", label: "Fluxo de Caixa" },
  ];

  // Mock de histórico
  const historicoRelatorios = [
    { id: 1, titulo: "Relatório de Receitas - Janeiro 2024", detalhe: "PDF • Gerado em 15/01/2024 às 14:30" },
    { id: 2, titulo: "Lista de Projetos Ativos", detalhe: "Excel • Gerado em 10/01/2024 às 09:15" },
    { id: 3, titulo: "Fluxo de Caixa - Dezembro 2023", detalhe: "CSV • Gerado em 02/01/2024 às 16:45" },
    { id: 4, titulo: "Relatório de Despesas - Dezembro 2023", detalhe: "PDF • Gerado em 02/01/2024 às 16:40" },
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
                        <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
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
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Gerar e Baixar
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
            Últimos relatórios gerados no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-0 divide-y divide-gray-100">
            {historicoRelatorios.map((relatorio) => (
              <div key={relatorio.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                    <FileText size={20} />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{relatorio.titulo}</p>
                    <p className="text-xs text-muted-foreground">{relatorio.detalhe}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-black/60 hover:text-black">
                  <Download className="mr-2 h-4 w-4" />
                  Baixar
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
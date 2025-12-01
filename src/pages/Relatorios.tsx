import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, FileText, Download } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function Relatorios() {
  const [tipoRelatorio, setTipoRelatorio] = useState("");
  const [formato, setFormato] = useState("");
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
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

    // Aqui seria implementada a lógica real de geração e download do relatório
    console.log("Gerando relatório:", {
      tipo: tipoRelatorio,
      formato,
      dataInicio: dateFrom,
      dataFim: dateTo,
    });
  };

  const tiposRelatorio = [
    { value: "receitas", label: "Receitas" },
    { value: "despesas", label: "Despesas" },
    { value: "projetos", label: "Projetos" },
    { value: "clientes", label: "Clientes" },
    { value: "funcionarios", label: "Funcionários" },
    { value: "financeiro-completo", label: "Financeiro Completo" },
    { value: "fluxo-caixa", label: "Fluxo de Caixa" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="vrz-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Gerar Relatório
            </CardTitle>
            <CardDescription>
              Configure e gere relatórios personalizados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tipoRelatorio">Tipo de Relatório</Label>
              <Select value={tipoRelatorio} onValueChange={setTipoRelatorio}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de relatório" />
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
              className="w-full vrz-button-primary"
            >
              <Download className="mr-2 h-4 w-4" />
              Gerar e Baixar Relatório
            </Button>
          </CardContent>
        </Card>

        <Card className="vrz-card">
          <CardHeader>
            <CardTitle>Relatórios Rápidos</CardTitle>
            <CardDescription>
              Acesse relatórios pré-configurados mais utilizados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                setTipoRelatorio("receitas");
                setFormato("pdf");
                handleGerarRelatorio();
              }}
            >
              <FileText className="mr-2 h-4 w-4" />
              Relatório de Receitas (PDF)
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                setTipoRelatorio("despesas");
                setFormato("pdf");
                handleGerarRelatorio();
              }}
            >
              <FileText className="mr-2 h-4 w-4" />
              Relatório de Despesas (PDF)
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                setTipoRelatorio("projetos");
                setFormato("xlsx");
                handleGerarRelatorio();
              }}
            >
              <FileText className="mr-2 h-4 w-4" />
              Lista de Projetos (Excel)
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                setTipoRelatorio("financeiro-completo");
                setFormato("pdf");
                handleGerarRelatorio();
              }}
            >
              <FileText className="mr-2 h-4 w-4" />
              Relatório Financeiro Completo (PDF)
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                setTipoRelatorio("fluxo-caixa");
                setFormato("csv");
                handleGerarRelatorio();
              }}
            >
              <FileText className="mr-2 h-4 w-4" />
              Fluxo de Caixa (CSV)
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="vrz-card">
        <CardHeader>
          <CardTitle>Histórico de Relatórios</CardTitle>
          <CardDescription>
            Últimos relatórios gerados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Relatório de Receitas - Janeiro 2024</p>
                <p className="text-sm text-muted-foreground">PDF • Gerado em 15/01/2024 às 14:30</p>
              </div>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Baixar
              </Button>
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Lista de Projetos Ativos</p>
                <p className="text-sm text-muted-foreground">Excel • Gerado em 10/01/2024 às 09:15</p>
              </div>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Baixar
              </Button>
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Fluxo de Caixa - Dezembro 2023</p>
                <p className="text-sm text-muted-foreground">CSV • Gerado em 02/01/2024 às 16:45</p>
              </div>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Baixar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
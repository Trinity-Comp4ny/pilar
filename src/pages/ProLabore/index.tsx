import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar as CalendarIcon, CheckCircle2, DollarSign, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

interface FolhaItem {
  p_id: string;
  p_nome: string;
  p_cargo: string;
  p_salario_fixo: number;
  p_valor_m2: number;
  soma_area: number;
  v_variavel: number;
  v_total: number;
  lista_projetos: string[];
  status?: string;
  data_pagamento?: string;
}

export default function ProLabore() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<FolhaItem[]>([]);
  const [statusFolha, setStatusFolha] = useState<'preview' | 'closed'>('preview');
  
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  
  const { toast } = useToast();

  const months = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' }
  ];

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // First check if we have a closed payroll for this period
      const { data: existingData, error: checkError } = await supabase
        .from('folha_pagamento')
        .select('*')
        .eq('mes', selectedMonth)
        .eq('ano', selectedYear);

      if (checkError) throw checkError;

      if (existingData && existingData.length > 0) {
        // We have saved data
        setStatusFolha('closed');
        
        // Need to fetch person details for display since folha_pagamento only has ID
        // But for simplicity let's join or fetch separately. 
        // Let's assume we map it to our interface
        
        // We need names and cargos. 
        const personIds = existingData.map(d => d.pessoa_id);
        const { data: peopleData } = await supabase
          .from('pessoas')
          .select('id, nome, cargo')
          .in('id', personIds);
          
        const peopleMap = new Map(peopleData?.map(p => [p.id, p]) || []);
        
        const mappedData: FolhaItem[] = existingData.map(item => ({
          p_id: item.pessoa_id,
          p_nome: peopleMap.get(item.pessoa_id)?.nome || 'Desconhecido',
          p_cargo: peopleMap.get(item.pessoa_id)?.cargo || '-',
          p_salario_fixo: item.salario_fixo,
          p_valor_m2: item.valor_m2,
          soma_area: item.total_area_projetada,
          v_variavel: item.adicional_variavel,
          v_total: item.total_receber,
          lista_projetos: [], // We don't store project list in history for now, could be an improvement
          status: item.status,
          data_pagamento: item.data_pagamento
        }));
        
        setData(mappedData);
      } else {
        // No saved data, fetch preview via RPC
        setStatusFolha('preview');
        const { data: previewData, error: rpcError } = await supabase
          .rpc('get_folha_preview', {
            p_mes: selectedMonth,
            p_ano: selectedYear
          });

        if (rpcError) throw rpcError;

        setData(previewData || []);
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseMonth = async () => {
    setSaving(true);
    try {
      const empresaId = (await supabase.rpc('get_user_empresa_id')).data;
      
      const payload = data.map(item => ({
        empresa_id: empresaId,
        pessoa_id: item.p_id,
        mes: selectedMonth,
        ano: selectedYear,
        salario_fixo: item.p_salario_fixo,
        total_area_projetada: item.soma_area,
        valor_m2: item.p_valor_m2,
        adicional_variavel: item.v_variavel,
        total_receber: item.v_total,
        status: 'pendente'
      }));

      const { error } = await supabase
        .from('folha_pagamento')
        .insert(payload);

      if (error) throw error;

      toast({
        title: "Folha fechada com sucesso!",
        description: `Os registros para ${months.find(m => m.value === selectedMonth)?.label}/${selectedYear} foram salvos.`
      });
      
      setConfirmDialogOpen(false);
      fetchData(); // Refresh to show closed state
      
    } catch (error: any) {
      toast({
        title: "Erro ao fechar folha",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const formatBRL = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const totalFolha = data.reduce((acc, item) => acc + item.v_total, 0);

  return (
    <PageLayout
      header={
        <PageHeader 
          title="Pro-Labore" 
          description="Gestão de pagamentos e produtividade"
        />
      }
    >
      <div className="space-y-6">
        {/* Filters and Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg border border-border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">Período:</span>
            </div>
            
            <Select 
              value={selectedMonth.toString()} 
              onValueChange={(v) => setSelectedMonth(parseInt(v))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {months.map(m => (
                  <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={selectedYear.toString()} 
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4">
            {statusFolha === 'preview' && data.length > 0 && (
              <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-accent-orange hover:bg-accent-orange/90">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Fechar Folha
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Fechar Folha de Pagamento</DialogTitle>
                    <DialogDescription>
                      Você está prestes a fechar a folha de <strong>{months.find(m => m.value === selectedMonth)?.label}/{selectedYear}</strong>.
                      <br /><br />
                      Isso irá gerar os registros financeiros para {data.length} pessoas, totalizando <strong>{formatCurrency(totalFolha)}</strong>.
                      <br /><br />
                      Esta ação confirmará os valores atuais e não refletirá mudanças futuras nos projetos deste mês.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleCloseMonth} disabled={saving} className="bg-accent-orange hover:bg-accent-orange/90">
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Confirmar Fechamento
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            
            {statusFolha === 'closed' && (
              <Badge variant="secondary" className="bg-green-100 text-green-800 px-3 py-1 text-sm flex gap-1 items-center">
                <CheckCircle2 className="h-3 w-3" />
                Folha Fechada
              </Badge>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total da Folha</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalFolha)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Soma de salários fixos + variáveis
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pessoas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Colaboradores listados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Área Projetada</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.reduce((acc, item) => acc + (item.soma_area || 0), 0).toLocaleString('pt-BR')} m²
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Produtividade do mês
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Table */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead className="text-right">Salário Fixo</TableHead>
                      <TableHead className="text-center">Produtividade</TableHead>
                      <TableHead className="text-right">Variável (m²)</TableHead>
                      <TableHead className="text-right font-bold">Total a Receber</TableHead>
                      {statusFolha === 'closed' && <TableHead className="text-center">Status</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhum registro encontrado para este período.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.map((item) => (
                        <TableRow key={item.p_id}>
                          <TableCell>
                            <div className="font-medium">{item.p_nome}</div>
                            {item.lista_projetos && item.lista_projetos.length > 0 && (
                              <div className="text-xs text-muted-foreground truncate max-w-[200px]" title={item.lista_projetos.join(', ')}>
                                {item.lista_projetos.length} projeto(s): {item.lista_projetos[0]} {item.lista_projetos.length > 1 && `+${item.lista_projetos.length - 1}`}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{item.p_cargo}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.p_salario_fixo)}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-medium">{item.soma_area.toLocaleString('pt-BR')} m²</span>
                              <span className="text-xs text-muted-foreground">x {formatCurrency(item.p_valor_m2)}/m²</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-green-600 font-medium">
                            + {formatCurrency(item.v_variavel)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-lg">
                            {formatCurrency(item.v_total)}
                          </TableCell>
                          {statusFolha === 'closed' && (
                            <TableCell className="text-center">
                              <Badge variant={item.status === 'pago' ? 'default' : 'secondary'} className="capitalize">
                                {item.status}
                              </Badge>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}

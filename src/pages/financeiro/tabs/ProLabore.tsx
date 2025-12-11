import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar as CalendarIcon, CheckCircle2, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  folha_id?: string;
  edited_fields?: string[]; // 'salario', 'area', 'variavel', 'total'
}

interface HistoryItem {
  mes: number;
  ano: number;
  total: number;
  count: number;
  status: string;
}

export default function ProLabore() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<FolhaItem[]>([]);
  const [statusFolha, setStatusFolha] = useState<'preview' | 'closed'>('preview');
  const [confirmedUsers, setConfirmedUsers] = useState<Set<string>>(new Set());
  const [totalUniqueArea, setTotalUniqueArea] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Dialogs
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [personConfirmDialogOpen, setPersonConfirmDialogOpen] = useState(false);
  
  // Detail/Edit Dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<FolhaItem | null>(null);
  const [editForm, setEditForm] = useState<Partial<FolhaItem>>({});

  // History Detail
  const [historyDetailOpen, setHistoryDetailOpen] = useState(false);
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false);
  const [historyDetailItems, setHistoryDetailItems] = useState<FolhaItem[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null);

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
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
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear]);

  // ... fetchHistory mantido igual ...
  const fetchHistory = async () => {
    try {
      const { data: historyData, error } = await supabase
        .from('folha_pagamento')
        .select('mes, ano, total_receber, status')
        .order('ano', { ascending: false })
        .order('mes', { ascending: false });

      if (error) throw error;

      const grouped = new Map<string, HistoryItem>();
      
      historyData?.forEach(item => {
        const key = `${item.mes}-${item.ano}`;
        const current = grouped.get(key) || { 
          mes: item.mes, 
          ano: item.ano, 
          total: 0, 
          count: 0, 
          status: item.status 
        };
        
        current.total += Number(item.total_receber || 0);
        current.count += 1;
        if (current.status !== item.status && current.count > 1) {
           if (item.status === 'pendente') current.status = 'pendente';
        }
        
        grouped.set(key, current);
      });

      setHistory(Array.from(grouped.values()));
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setConfirmedUsers(new Set());
    try {
      const { data: projectsData } = await supabase
        .from('projetos')
        .select('area_m2, data_inicio')
        .eq('empresa_id', (await supabase.rpc('get_user_empresa_id')).data);
      
      const uniqueArea = (projectsData || [])
        .filter(p => {
          if (!p.data_inicio) return false;
          const [ano, mes] = p.data_inicio.split('-').map(Number);
          return ano === selectedYear && mes === selectedMonth;
        })
        .reduce((acc, curr) => acc + Number(curr.area_m2 || 0), 0);
        
      setTotalUniqueArea(uniqueArea);

      const { data: existingData, error: checkError } = await supabase
        .from('folha_pagamento')
        .select('*')
        .eq('mes', selectedMonth)
        .eq('ano', selectedYear);

      if (checkError) throw checkError;

      if (existingData && existingData.length > 0) {
        setStatusFolha('closed');
        const personIds = existingData.map((d: any) => d.pessoa_id);
        const { data: peopleData } = await supabase
          .from('pessoas')
          .select('id, nome, cargo')
          .in('id', personIds);

        const peopleMap = new Map((peopleData || []).map((p: any) => [p.id, p]));

        const mappedData: FolhaItem[] = existingData.map((item: any) => {
          const salario_fixo = Number(item.salario_fixo ?? 0);
          const valor_m2 = Number(item.valor_m2 ?? 0);
          const soma_area = Number(item.total_area_projetada ?? 0);
          const v_variavel = Number(item.adicional_variavel ?? soma_area * valor_m2);
          const v_total = Number(item.total_receber ?? salario_fixo + v_variavel);

          return {
            p_id: item.pessoa_id,
            p_nome: peopleMap.get(item.pessoa_id)?.nome || 'Desconhecido',
            p_cargo: peopleMap.get(item.pessoa_id)?.cargo || '-',
            p_salario_fixo: salario_fixo,
            p_valor_m2: valor_m2,
            soma_area,
            v_variavel,
            v_total,
            lista_projetos: [],
            status: item.status,
            data_pagamento: item.data_pagamento,
            folha_id: item.id,
            edited_fields: []
          };
        });

        setData(mappedData);
      } else {
        setStatusFolha('preview');
        const { data: previewData, error: rpcError } = await supabase
          .rpc('get_folha_preview', {
            p_mes: selectedMonth,
            p_ano: selectedYear
          });

        if (rpcError) throw rpcError;

        const normalized: FolhaItem[] = (previewData || []).map((item: any) => {
          const salario_fixo = Number(item.p_salario_fixo ?? item.salario_fixo ?? 0);
          const valor_m2 = Number(item.p_valor_m2 ?? item.valor_m2 ?? 0);
          const soma_area = Number(item.soma_area ?? item.total_area ?? 0);
          const v_variavel = Number(
            item.v_variavel ??
            item.total_variavel ??
            soma_area * valor_m2
          );
          const v_total = Number(
            item.v_total ??
            item.total_receber ??
            salario_fixo + v_variavel
          );

          return {
            p_id: item.p_id ?? item.pessoa_id ?? item.id,
            p_nome: item.p_nome ?? item.nome ?? '',
            p_cargo: item.p_cargo ?? item.cargo ?? '',
            p_salario_fixo: salario_fixo,
            p_valor_m2: valor_m2,
            soma_area,
            v_variavel,
            v_total,
            lista_projetos: item.lista_projetos ?? item.projetos_nomes ?? [],
            edited_fields: []
          };
        });

        setData(normalized);
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
      
      const payload = data.map((item) => ({
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
        description: `Os registros para ${months.find((m) => m.value === selectedMonth)?.label}/${selectedYear} foram salvos.`
      });
      
      setConfirmDialogOpen(false);
      fetchData();
      fetchHistory();
      
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

  // Checkbox logic: if not checked, open dialog to confirm. If checked, uncheck immediately.
  const handleCheckboxChange = (item: FolhaItem, isChecked: boolean) => {
    if (isChecked) {
      // User wants to check
      setSelectedPerson(item);
      setPersonConfirmDialogOpen(true);
    } else {
      // User wants to uncheck
      const next = new Set(confirmedUsers);
      next.delete(item.p_id);
      setConfirmedUsers(next);
    }
  };

  const confirmPerson = () => {
    if (!selectedPerson) return;
    const next = new Set(confirmedUsers);
    next.add(selectedPerson.p_id);
    setConfirmedUsers(next);
    setPersonConfirmDialogOpen(false);
    setSelectedPerson(null);
  };

  // Open Detail/Edit Modal
  const openDetailDialog = (item: FolhaItem) => {
    setSelectedPerson(item);
    setIsEditingDetail(false);
    setEditForm({});
    setDetailDialogOpen(true);
  };

  const startEditing = () => {
    if (!selectedPerson) return;
    setEditForm({
      p_salario_fixo: selectedPerson.p_salario_fixo,
      soma_area: selectedPerson.soma_area,
      v_variavel: selectedPerson.v_variavel,
      v_total: selectedPerson.v_total
    });
    setIsEditingDetail(true);
  };

  const saveEditing = () => {
    if (!selectedPerson) return;
    
    // Determine modified fields
    const newEditedFields = new Set(selectedPerson.edited_fields || []);
    
    if (editForm.p_salario_fixo !== selectedPerson.p_salario_fixo) newEditedFields.add('salario');
    if (editForm.soma_area !== selectedPerson.soma_area) newEditedFields.add('area');
    if (editForm.v_variavel !== selectedPerson.v_variavel) newEditedFields.add('variavel');
    if (editForm.v_total !== selectedPerson.v_total) newEditedFields.add('total');

    const updatedItem = {
      ...selectedPerson,
      ...editForm,
      edited_fields: Array.from(newEditedFields)
    };

    setData(prev => prev.map(p => p.p_id === selectedPerson.p_id ? updatedItem as FolhaItem : p));
    
    setIsEditingDetail(false);
    setDetailDialogOpen(false);
    setSelectedPerson(null);
    
    toast({ title: "Alterações salvas no preview" });
  };

  const handleStatusChange = async (folhaId: string | undefined, newStatus: string) => {
    if (!folhaId) return;

    const currentItem = data.find((item) => item.folha_id === folhaId);
    if (!currentItem) return;

    const previousStatus = currentItem.status;

    try {
      const { error } = await supabase
        .from('folha_pagamento')
        .update({ status: newStatus })
        .eq('id', folhaId);
        
      if (error) throw error;
      
      setData(prev => prev.map(item => 
        item.folha_id === folhaId ? { ...item, status: newStatus } : item
      ));

      if (previousStatus !== 'pago' && newStatus === 'pago') {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10);

        const { data: categorias } = await (supabase.from('categorias_financeiras') as any)
          .select('id, nome')
          .eq('tipo', 'Despesa');

        const categoriaProLabore = categorias?.find((c: any) => c.nome === 'Pró-Labore');

        const descricao = `Pró-Labore ${months.find((m) => m.value === selectedMonth)?.label}/${selectedYear} - ${currentItem.p_nome}`;

        const despesaPayload = {
          data_vencimento: dateStr,
          data_pagamento: dateStr,
          descricao,
          categoria_id: categoriaProLabore ? categoriaProLabore.id : null,
          valor: currentItem.v_total,
          fornecedor_id: null,
          projeto_id: null,
          nota_fiscal: null,
          status: 'Pago',
          conta_id: null,
          cartao_id: null,
          observacao: 'Lançamento automático de Pró-Labore',
        };

        const { error: despesaError } = await (supabase.from('despesas') as any).insert([despesaPayload]);
        if (despesaError) {
          console.error('Erro ao lançar despesa de pró-labore:', despesaError);
        }
      }
      
      toast({
        title: "Status atualizado",
        description: `O status foi alterado para ${newStatus}.`
      });
      
      fetchHistory(); 
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const openHistoryDetail = async (historyItem: HistoryItem) => {
    // ... mantido igual ...
    setSelectedHistory(historyItem);
    setHistoryDetailOpen(true);
    setHistoryDetailLoading(true);

    try {
      const { data: existingData, error } = await supabase
        .from('folha_pagamento')
        .select('*')
        .eq('mes', historyItem.mes)
        .eq('ano', historyItem.ano);

      if (error) throw error;

      if (!existingData || existingData.length === 0) {
        setHistoryDetailItems([]);
      } else {
        const personIds = existingData.map((d: any) => d.pessoa_id);
        const { data: peopleData } = await supabase
          .from('pessoas')
          .select('id, nome, cargo')
          .in('id', personIds);

        const peopleMap = new Map((peopleData || []).map((p: any) => [p.id, p]));

        const mappedData: FolhaItem[] = existingData.map((item: any) => {
          const salario_fixo = Number(item.salario_fixo ?? 0);
          const valor_m2 = Number(item.valor_m2 ?? 0);
          const soma_area = Number(item.total_area_projetada ?? 0);
          const v_variavel = Number(item.adicional_variavel ?? soma_area * valor_m2);
          const v_total = Number(item.total_receber ?? salario_fixo + v_variavel);

          return {
            p_id: item.pessoa_id,
            p_nome: peopleMap.get(item.pessoa_id)?.nome || 'Desconhecido',
            p_cargo: peopleMap.get(item.pessoa_id)?.cargo || '-',
            p_salario_fixo: salario_fixo,
            p_valor_m2: valor_m2,
            soma_area,
            v_variavel,
            v_total,
            lista_projetos: [],
            status: item.status,
            data_pagamento: item.data_pagamento,
            folha_id: item.id
          };
        });

        setHistoryDetailItems(mappedData);
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes do histórico:', error);
      toast({
        title: 'Erro ao carregar detalhes',
        description: 'Não foi possível carregar os detalhes da folha selecionada.',
        variant: 'destructive',
      });
    } finally {
      setHistoryDetailLoading(false);
    }
  };

  const totalFolha = data.reduce((acc, item) => acc + item.v_total, 0);
  const allConfirmed = data.length > 0 && confirmedUsers.size === data.length;

  const isEdited = (item: FolhaItem, field: string) => item.edited_fields?.includes(field);

  return (
    <div className="space-y-8 pb-10">
      <div className="space-y-6">
        {/* Filtros e ações */}
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
                {months.map((m) => (
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
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4">
            {statusFolha === 'preview' && data.length > 0 && (
              <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    className="bg-accent-orange hover:bg-accent-orange/90"
                    disabled={!allConfirmed}
                    title={!allConfirmed ? "Confirme todos os colaboradores para fechar a folha" : ""}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Fechar Folha
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Fechar Folha de Pagamento</DialogTitle>
                    <DialogDescription>
                      Você está prestes a fechar a folha de <strong>{months.find((m) => m.value === selectedMonth)?.label}/{selectedYear}</strong>.
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

        {/* Cards de resumo */}
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
                {totalUniqueArea.toLocaleString('pt-BR')} m²
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Soma da área de projetos únicos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela principal */}
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
                      {statusFolha === 'preview' && <TableHead className="w-[50px] text-center">Conf.</TableHead>}
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
                        <TableCell colSpan={statusFolha === 'preview' ? 8 : 7} className="text-center py-8 text-muted-foreground">
                          Nenhum registro encontrado para este período.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.map((item, index) => {
                        const area = item.soma_area ?? 0;
                        const isConfirmed = confirmedUsers.has(item.p_id);
                        return (
                        <TableRow 
                          key={item.p_id || `${item.p_nome}-${index}`}
                          className={statusFolha === 'preview' ? 'cursor-pointer hover:bg-gray-50' : ''}
                          onClick={() => statusFolha === 'preview' && openDetailDialog(item)}
                        >
                          {statusFolha === 'preview' && (
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <Checkbox 
                                checked={isConfirmed}
                                onCheckedChange={(checked) => handleCheckboxChange(item, checked as boolean)}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="font-medium">{item.p_nome}</div>
                            {item.lista_projetos && item.lista_projetos.length > 0 && (
                              <div className="text-xs text-muted-foreground truncate max-w-[200px]" title={item.lista_projetos.join(', ')}>
                                {item.lista_projetos.length} projeto(s): {item.lista_projetos[0]} {item.lista_projetos.length > 1 && `+${item.lista_projetos.length - 1}`}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{item.p_cargo}</TableCell>
                          <TableCell className={`text-right ${isEdited(item, 'salario') ? 'text-accent-orange font-medium' : ''}`}>
                            {formatCurrency(item.p_salario_fixo)} {isEdited(item, 'salario') && '*'}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center">
                              <span className={`font-medium ${isEdited(item, 'area') ? 'text-accent-orange' : ''}`}>
                                {area.toLocaleString('pt-BR')} m² {isEdited(item, 'area') && '*'}
                              </span>
                              <span className="text-xs text-muted-foreground">x {formatCurrency(item.p_valor_m2)}/m²</span>
                            </div>
                          </TableCell>
                          <TableCell className={`text-right font-medium ${isEdited(item, 'variavel') ? 'text-accent-orange' : 'text-green-600'}`}>
                            {isEdited(item, 'variavel') ? '' : '+'} {formatCurrency(item.v_variavel)} {isEdited(item, 'variavel') && '*'}
                          </TableCell>
                          <TableCell className={`text-right font-bold text-lg ${isEdited(item, 'total') ? 'text-accent-orange' : ''}`}>
                            {formatCurrency(item.v_total)} {isEdited(item, 'total') && '*'}
                          </TableCell>
                          {statusFolha === 'closed' && (
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-8 w-auto p-0 px-2 font-normal">
                                    <Badge 
                                      variant="secondary" 
                                      className={`capitalize cursor-pointer hover:bg-opacity-80 transition-colors px-2 py-0.5 text-xs
                                        ${item.status === 'pago' ? 'bg-green-500 text-white' : ''}
                                        ${item.status === 'pendente' ? 'bg-yellow-400 text-black' : ''}
                                        ${item.status === 'cancelado' ? 'bg-red-500 text-white' : ''}
                                      `}
                                    >
                                      {item.status}
                                    </Badge>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleStatusChange(item.folha_id, 'pendente')}>
                                    Marcar como Pendente
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleStatusChange(item.folha_id, 'pago')}>
                                    Marcar como Pago
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleStatusChange(item.folha_id, 'cancelado')} className="text-red-600">
                                    Cancelar Pagamento
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          )}
                        </TableRow>
                      )})
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Histórico */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <History className="h-5 w-5" />
          Histórico de Folhas
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {history.length === 0 ? (
            <p className="text-muted-foreground text-sm col-span-3">Nenhum histórico encontrado.</p>
          ) : (
            history.map((h) => (
              <Card 
                key={`${h.mes}-${h.ano}`} 
                className={`cursor-pointer transition-all hover:border-accent-orange/50 hover:shadow-md ${selectedMonth === h.mes && selectedYear === h.ano ? 'border-accent-orange bg-accent-orange/5' : ''}`}
                onClick={() => {
                  openHistoryDetail(h);
                }}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-lg">{months.find(m => m.value === h.mes)?.label} {h.ano}</div>
                    <div className="text-sm text-muted-foreground">{h.count} colaboradores</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-accent-orange">{formatCurrency(h.total)}</div>
                    <Badge
                      variant="secondary"
                      className={`mt-1 capitalize text-[10px] h-5 px-2
                        ${h.status === 'pago' ? 'bg-green-500 text-white' : ''}
                        ${h.status === 'pendente' ? 'bg-yellow-400 text-black' : ''}
                        ${h.status === 'cancelado' ? 'bg-red-500 text-white' : ''}
                      `}
                    >
                      {h.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Modal Confirmar/Desmarcar (checkbox action) */}
      <Dialog open={personConfirmDialogOpen} onOpenChange={setPersonConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Pró-Labore</DialogTitle>
            <DialogDescription>
              Confira os dados antes de confirmar o colaborador.
            </DialogDescription>
          </DialogHeader>
          {selectedPerson && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-semibold">Colaborador: </span>
                <span>{selectedPerson.p_nome}</span>
              </div>
              <div>
                <span className="font-semibold">Cargo: </span>
                <span>{selectedPerson.p_cargo}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="font-semibold">Salário Fixo: </span>
                <span>{formatCurrency(selectedPerson.p_salario_fixo)}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="font-semibold">Variável: </span>
                <span>{formatCurrency(selectedPerson.v_variavel)}</span>
              </div>
              <div className="flex justify-between text-lg pt-1">
                <span className="font-semibold">Total a Receber: </span>
                <span className="font-bold text-green-600">{formatCurrency(selectedPerson.v_total)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPersonConfirmDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmPerson} className="bg-accent-orange hover:bg-accent-orange/90">
              Confirmar Colaborador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Detalhes e Edição */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditingDetail ? 'Editar Pró-Labore' : 'Detalhes do Pró-Labore'}</DialogTitle>
            <DialogDescription>
              {isEditingDetail 
                ? 'Ajuste os valores manualmente. As alterações serão salvas apenas para este mês.' 
                : 'Informações detalhadas do colaborador.'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPerson && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">Colaborador</label>
                  <p className="font-medium">{selectedPerson.p_nome}</p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Salário Fixo</label>
                  {isEditingDetail ? (
                    <Input 
                      type="number" 
                      value={editForm.p_salario_fixo} 
                      onChange={(e) => setEditForm(prev => ({ ...prev, p_salario_fixo: parseFloat(e.target.value) || 0 }))}
                    />
                  ) : (
                    <p>{formatCurrency(selectedPerson.p_salario_fixo)}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Produtividade (m²)</label>
                   {isEditingDetail ? (
                    <Input 
                      type="number" 
                      value={editForm.soma_area} 
                      onChange={(e) => setEditForm(prev => ({ ...prev, soma_area: parseFloat(e.target.value) || 0 }))}
                    />
                  ) : (
                    <p>{selectedPerson.soma_area?.toLocaleString('pt-BR')} m²</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Variável</label>
                   {isEditingDetail ? (
                    <Input 
                      type="number" 
                      value={editForm.v_variavel} 
                      onChange={(e) => setEditForm(prev => ({ ...prev, v_variavel: parseFloat(e.target.value) || 0 }))}
                    />
                  ) : (
                    <p>{formatCurrency(selectedPerson.v_variavel)}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Total</label>
                   {isEditingDetail ? (
                    <Input 
                      type="number" 
                      value={editForm.v_total} 
                      onChange={(e) => setEditForm(prev => ({ ...prev, v_total: parseFloat(e.target.value) || 0 }))}
                    />
                  ) : (
                    <p className="font-bold text-lg text-green-600">{formatCurrency(selectedPerson.v_total)}</p>
                  )}
                </div>
              </div>
              
              {!isEditingDetail && selectedPerson.edited_fields && selectedPerson.edited_fields.length > 0 && (
                <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                  * Campos editados manualmente: {selectedPerson.edited_fields.join(', ')}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex gap-2">
            {isEditingDetail ? (
              <>
                <Button variant="outline" onClick={() => setIsEditingDetail(false)}>Cancelar</Button>
                <Button onClick={saveEditing} className="bg-accent-orange hover:bg-accent-orange/90">Salvar Alterações</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Fechar</Button>
                <Button onClick={startEditing}>Editar</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyDetailOpen} onOpenChange={setHistoryDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Detalhes da Folha {selectedHistory && `${months.find((m) => m.value === selectedHistory.mes)?.label}/${selectedHistory.ano}`}
            </DialogTitle>
            <DialogDescription>
              Visualização completa dos colaboradores e valores da folha selecionada.
            </DialogDescription>
          </DialogHeader>
          {historyDetailLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : historyDetailItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro encontrado para esta folha.</p>
          ) : (
            <div className="overflow-x-auto max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead className="text-right">Salário Fixo</TableHead>
                    <TableHead className="text-center">Produtividade</TableHead>
                    <TableHead className="text-right">Variável (m²)</TableHead>
                    <TableHead className="text-right">Total a Receber</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyDetailItems.map((item, index) => {
                    const area = item.soma_area ?? 0;
                    return (
                      <TableRow key={item.p_id || `${item.p_nome}-${index}`}>
                        <TableCell>{item.p_nome}</TableCell>
                        <TableCell>{item.p_cargo}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.p_salario_fixo)}</TableCell>
                        <TableCell className="text-center">{area.toLocaleString('pt-BR')} m²</TableCell>
                        <TableCell className="text-right text-green-600 font-medium">{formatCurrency(item.v_variavel)}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(item.v_total)}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="secondary"
                            className={`capitalize text-xs px-2 py-0.5
                              ${item.status === 'pago' ? 'bg-green-500 text-white' : ''}
                              ${item.status === 'pendente' ? 'bg-yellow-400 text-black' : ''}
                              ${item.status === 'cancelado' ? 'bg-red-500 text-white' : ''}
                            `}
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Modal Confirmar/Desmarcar (checkbox action) */}
      <Dialog open={personConfirmDialogOpen} onOpenChange={setPersonConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Pró-Labore</DialogTitle>
            <DialogDescription>
              Confira os dados antes de confirmar o colaborador.
            </DialogDescription>
          </DialogHeader>
          {selectedPerson && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-semibold">Colaborador: </span>
                <span>{selectedPerson.p_nome}</span>
              </div>
              <div>
                <span className="font-semibold">Cargo: </span>
                <span>{selectedPerson.p_cargo}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="font-semibold">Salário Fixo: </span>
                <span>{formatCurrency(selectedPerson.p_salario_fixo)}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="font-semibold">Variável: </span>
                <span>{formatCurrency(selectedPerson.v_variavel)}</span>
              </div>
              <div className="flex justify-between text-lg pt-1">
                <span className="font-semibold">Total a Receber: </span>
                <span className="font-bold text-green-600">{formatCurrency(selectedPerson.v_total)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPersonConfirmDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmPerson} className="bg-accent-orange hover:bg-accent-orange/90">
              Confirmar Colaborador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Detalhes e Edição */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditingDetail ? 'Editar Pró-Labore' : 'Detalhes do Pró-Labore'}</DialogTitle>
            <DialogDescription>
              {isEditingDetail 
                ? 'Ajuste os valores manualmente. As alterações serão salvas apenas para este mês.' 
                : 'Informações detalhadas do colaborador.'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPerson && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">Colaborador</label>
                  <p className="font-medium">{selectedPerson.p_nome}</p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Salário Fixo</label>
                  {isEditingDetail ? (
                    <Input 
                      type="number" 
                      value={editForm.p_salario_fixo} 
                      onChange={(e) => setEditForm(prev => ({ ...prev, p_salario_fixo: parseFloat(e.target.value) || 0 }))}
                    />
                  ) : (
                    <p>{formatCurrency(selectedPerson.p_salario_fixo)}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Produtividade (m²)</label>
                   {isEditingDetail ? (
                    <Input 
                      type="number" 
                      value={editForm.soma_area} 
                      onChange={(e) => setEditForm(prev => ({ ...prev, soma_area: parseFloat(e.target.value) || 0 }))}
                    />
                  ) : (
                    <p>{selectedPerson.soma_area?.toLocaleString('pt-BR')} m²</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Variável</label>
                   {isEditingDetail ? (
                    <Input 
                      type="number" 
                      value={editForm.v_variavel} 
                      onChange={(e) => setEditForm(prev => ({ ...prev, v_variavel: parseFloat(e.target.value) || 0 }))}
                    />
                  ) : (
                    <p>{formatCurrency(selectedPerson.v_variavel)}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Total</label>
                   {isEditingDetail ? (
                    <Input 
                      type="number" 
                      value={editForm.v_total} 
                      onChange={(e) => setEditForm(prev => ({ ...prev, v_total: parseFloat(e.target.value) || 0 }))}
                    />
                  ) : (
                    <p className="font-bold text-lg text-green-600">{formatCurrency(selectedPerson.v_total)}</p>
                  )}
                </div>
              </div>
              
              {!isEditingDetail && selectedPerson.edited_fields && selectedPerson.edited_fields.length > 0 && (
                <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                  * Campos editados manualmente: {selectedPerson.edited_fields.join(', ')}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex gap-2">
            {isEditingDetail ? (
              <>
                <Button variant="outline" onClick={() => setIsEditingDetail(false)}>Cancelar</Button>
                <Button onClick={saveEditing} className="bg-accent-orange hover:bg-accent-orange/90">Salvar Alterações</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Fechar</Button>
                <Button onClick={startEditing}>Editar</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

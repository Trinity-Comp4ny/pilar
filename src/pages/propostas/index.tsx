import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus,
  FileText,
  Loader2,
  Trash2,
  Send,
  CheckCircle2,
  FolderPlus,
  Download,
  LayoutTemplate,
} from "lucide-react";
import { DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  usePropostas,
  useCreateProposta,
  useUpdateProposta,
  useDeleteProposta,
  useConverterProposta,
  usePropostaDisciplinas,
  PROPOSTA_STATUS_CONFIG,
  type PropostaInsert,
} from "@/hooks/usePropostas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrencyInput, parseCurrencyString } from "@/lib/currencyUtils";
import { CapacidadeSimulacao } from "./components/CapacidadeSimulacao";
import { TemplatesManager } from "./components/TemplatesManager";
import { GerarPropostaDialog } from "./components/GerarPropostaDialog";

interface PropostaDisciplina {
  id: string;
  disciplina: string;
  horas_estimadas: number;
  custo_hora: number;
}
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export default function Propostas() {
  const { data: userRole } = useUserRole();
  const { toast } = useToast();
  const { data: propostas = [], isLoading } = usePropostas();
  const createProposta = useCreateProposta();
  const updateProposta = useUpdateProposta();
  const deleteProposta = useDeleteProposta();

  const converterProposta = useConverterProposta();
  const navigate = useNavigate();

  const canEdit = userRole === "admin" || userRole === "operacional" || userRole === "marketing";
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [convertPropostaId, setConvertPropostaId] = useState<string | null>(null);
  const [gerarDocxPropostaId, setGerarDocxPropostaId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("propostas");

  const gerarDocxProposta = propostas.find((p) => p.id === gerarDocxPropostaId);
  const { data: gerarDocxDisciplinas = [] } = usePropostaDisciplinas(gerarDocxPropostaId);

  const convertProposta = propostas.find((p) => p.id === convertPropostaId);
  const { data: convertDisciplinas = [] } = usePropostaDisciplinas(convertPropostaId);

  // Form state
  const [form, setForm] = useState<PropostaInsert>({
    titulo: "",
    codigo: "",
    area_m2: undefined,
    localizacao: "",
    valor_proposto: undefined,
    prazo_estimado_dias: undefined,
    observacao: "",
  });
  const [valorDisplay, setValorDisplay] = useState("");

  // Clientes e leads para o select
  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-select"],
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("id, nome").is("deleted_at", null).order("nome");
      return data || [];
    },
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads-select"],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("id, nome").is("deleted_at", null).order("nome");
      return data || [];
    },
  });

  const resetForm = () => {
    setForm({
      titulo: "",
      codigo: "",
      area_m2: undefined,
      localizacao: "",
      valor_proposto: undefined,
      prazo_estimado_dias: undefined,
      observacao: "",
    });
    setValorDisplay("");
  };

  const handleCreate = () => {
    if (!form.titulo.trim()) {
      toast({ variant: "destructive", title: "Título é obrigatório" });
      return;
    }

    const valorProposto = parseCurrencyString(valorDisplay);
    createProposta.mutate(
      { ...form, valor_proposto: valorProposto || undefined },
      {
        onSuccess: () => {
          toast({ title: "Proposta criada" });
          setIsFormOpen(false);
          resetForm();
        },
        onError: (err: Error) => toast({ variant: "destructive", title: "Erro", description: err.message }),
      }
    );
  };

  const handleStatusChange = (id: string, status: string) => {
    updateProposta.mutate(
      { id, status },
      {
        onSuccess: () => toast({ title: `Proposta ${PROPOSTA_STATUS_CONFIG[status]?.label || status}` }),
        onError: (err: Error) => toast({ variant: "destructive", title: "Erro", description: err.message }),
      }
    );
  };

  const handleDelete = () => {
    if (!confirmDeleteId) return;
    deleteProposta.mutate(confirmDeleteId, {
      onSuccess: () => {
        toast({ title: "Proposta removida" });
        setConfirmDeleteId(null);
      },
      onError: (err: Error) => toast({ variant: "destructive", title: "Erro", description: err.message }),
    });
  };

  const handleConverterEmProjeto = () => {
    if (!convertPropostaId) return;
    converterProposta.mutate(convertPropostaId, {
      onSuccess: (projetoId) => {
        toast({
          title: "Projeto criado!",
          description: "A proposta foi convertida em projeto com orçamento pré-preenchido.",
        });
        setConvertPropostaId(null);
        navigate(`/projetos/${projetoId}`);
      },
      onError: (err: Error) => toast({ variant: "destructive", title: "Erro na conversão", description: err.message }),
    });
  };

  const formatCurrency = (v: number | null) =>
    v ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : "—";

  const formatDate = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");

  // Métricas
  const totalPropostas = propostas.length;
  const valorTotal = propostas.reduce((s, p) => s + (p.valor_proposto || 0), 0);
  const aceitas = propostas.filter((p) => p.status === "aceita").length;
  const taxaConversao = totalPropostas > 0 ? ((aceitas / totalPropostas) * 100).toFixed(0) : "0";

  if (isLoading) {
    return (
      <PageLayout>
        <PageHeader title="Propostas" description="Gerencie suas propostas comerciais" />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader title="Propostas" description="Gerencie suas propostas comerciais">
        <div className="flex items-center gap-2">
          {canEdit && activeTab === "propostas" && (
            <Button
              onClick={() => {
                resetForm();
                setIsFormOpen(true);
              }}
              className="bg-accent-orange hover:bg-accent-orange/90 text-white"
            >
              <Plus className="h-4 w-4 mr-1" /> Nova Proposta
            </Button>
          )}
        </div>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="propostas" className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Propostas
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-1.5">
            <LayoutTemplate className="h-3.5 w-3.5" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="propostas" className="mt-0">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{totalPropostas}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Valor Pipeline</p>
                <p className="text-xl font-bold">{formatCurrency(valorTotal)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Aceitas</p>
                <p className="text-xl font-bold">{aceitas}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Conversão</p>
                <p className="text-xl font-bold">{taxaConversao}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabela */}
          {propostas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma proposta cadastrada.</p>
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Código</TableHead>
                      <TableHead className="text-xs">Título</TableHead>
                      <TableHead className="text-xs">Cliente/Lead</TableHead>
                      <TableHead className="text-xs text-right">Valor</TableHead>
                      <TableHead className="text-xs text-center">Status</TableHead>
                      <TableHead className="text-xs">Validade</TableHead>
                      {canEdit && <TableHead className="text-xs text-right">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {propostas.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs py-2 font-medium">{p.codigo || "—"}</TableCell>
                        <TableCell className="text-xs py-2">{p.titulo}</TableCell>
                        <TableCell className="text-xs py-2">{p.cliente_nome || p.lead_nome || "—"}</TableCell>
                        <TableCell className="text-xs py-2 text-right">{formatCurrency(p.valor_proposto)}</TableCell>
                        <TableCell className="text-xs py-2 text-center">
                          <Badge className={`text-[10px] ${PROPOSTA_STATUS_CONFIG[p.status]?.color || ""}`}>
                            {PROPOSTA_STATUS_CONFIG[p.status]?.label || p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs py-2">{formatDate(p.validade)}</TableCell>
                        {canEdit && (
                          <TableCell className="text-xs py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-accent-orange"
                                title="Gerar DOCX"
                                onClick={() => setGerarDocxPropostaId(p.id)}
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                              {p.status === "rascunho" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-blue-600"
                                  title="Enviar"
                                  onClick={() => handleStatusChange(p.id, "enviada")}
                                >
                                  <Send className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {p.status === "enviada" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-green-600"
                                    title="Aceitar"
                                    onClick={() => handleStatusChange(p.id, "aceita")}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-blue-600"
                                    title="Aceitar e criar projeto"
                                    onClick={() => setConvertPropostaId(p.id)}
                                  >
                                    <FolderPlus className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                              {p.status === "aceita" && !p.projeto_id && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-blue-600"
                                  title="Criar projeto"
                                  onClick={() => setConvertPropostaId(p.id)}
                                >
                                  <FolderPlus className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500"
                                onClick={() => setConfirmDeleteId(p.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-0">
          <TemplatesManager />
        </TabsContent>
      </Tabs>

      {/* Dialog de criação */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Proposta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input
                  value={form.codigo || ""}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  placeholder="PROP-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  placeholder="Título da proposta"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={form.cliente_id || ""} onValueChange={(v) => setForm({ ...form, cliente_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Lead</Label>
                <Select value={form.lead_id || ""} onValueChange={(v) => setForm({ ...form, lead_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {leads.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Valor Proposto</Label>
                <Input
                  value={valorDisplay}
                  onChange={(e) => setValorDisplay(formatCurrencyInput(e.target.value))}
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="space-y-2">
                <Label>Área (m²)</Label>
                <Input
                  type="number"
                  value={form.area_m2 || ""}
                  onChange={(e) => setForm({ ...form, area_m2: parseFloat(e.target.value) || undefined })}
                />
              </div>
              <div className="space-y-2">
                <Label>Prazo (dias)</Label>
                <Input
                  type="number"
                  value={form.prazo_estimado_dias || ""}
                  onChange={(e) => setForm({ ...form, prazo_estimado_dias: parseInt(e.target.value) || undefined })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Localização</Label>
              <Input
                value={form.localizacao || ""}
                onChange={(e) => setForm({ ...form, localizacao: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={form.observacao || ""}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={createProposta.isPending}>
                Criar Proposta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null);
        }}
        title="Excluir Proposta"
        description="Tem certeza que deseja excluir esta proposta?"
        onConfirm={handleDelete}
      />

      {/* Dialog de Conversão Proposta → Projeto */}
      <Dialog
        open={!!convertPropostaId}
        onOpenChange={(open) => {
          if (!open) setConvertPropostaId(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-blue-600" />
              Converter em Projeto
            </DialogTitle>
            <DialogDescription>
              Um novo projeto será criado automaticamente com os dados desta proposta.
            </DialogDescription>
          </DialogHeader>

          {convertProposta && (
            <div className="space-y-4 mt-2">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Título</span>
                  <span className="font-medium">{convertProposta.titulo}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="font-medium">
                    {convertProposta.cliente_nome || convertProposta.lead_nome || "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor</span>
                  <span className="font-medium">{formatCurrency(convertProposta.valor_proposto)}</span>
                </div>
                {convertProposta.area_m2 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Área</span>
                    <span className="font-medium">{convertProposta.area_m2} m²</span>
                  </div>
                )}
                {convertProposta.prazo_estimado_dias && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Prazo</span>
                    <span className="font-medium">{convertProposta.prazo_estimado_dias} dias</span>
                  </div>
                )}
              </div>

              {convertDisciplinas.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Disciplinas (serão copiadas para o orçamento):
                  </p>
                  <div className="space-y-1">
                    {convertDisciplinas.map((d: PropostaDisciplina) => (
                      <div
                        key={d.id}
                        className="flex justify-between items-center text-xs bg-blue-50 rounded px-3 py-1.5"
                      >
                        <span className="font-medium">{d.disciplina}</span>
                        <span className="text-muted-foreground">
                          {d.horas_estimadas}h · R$ {Number(d.custo_hora).toFixed(0)}/h
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {convertDisciplinas.length > 0 && (
                <CapacidadeSimulacao
                  disciplinas={convertDisciplinas.map((d: PropostaDisciplina) => ({
                    disciplina: d.disciplina,
                    horas_estimadas: Number(d.horas_estimadas) || 0,
                  }))}
                  prazoEstimadoDias={convertProposta?.prazo_estimado_dias || undefined}
                />
              )}

              <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg p-3">
                O projeto será criado com status "Planejamento" e orçamento por disciplina pré-preenchido. Você poderá
                editar tudo depois.
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setConvertPropostaId(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConverterEmProjeto}
              disabled={converterProposta.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {converterProposta.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando...
                </>
              ) : (
                "Criar Projeto"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Gerar DOCX */}
      {gerarDocxProposta && (
        <GerarPropostaDialog
          open={!!gerarDocxPropostaId}
          onOpenChange={(open) => {
            if (!open) setGerarDocxPropostaId(null);
          }}
          proposta={gerarDocxProposta}
          disciplinas={gerarDocxDisciplinas.map((d: PropostaDisciplina) => ({
            disciplina: d.disciplina,
            horas_estimadas: Number(d.horas_estimadas),
            custo_hora: Number(d.custo_hora),
          }))}
        />
      )}
    </PageLayout>
  );
}

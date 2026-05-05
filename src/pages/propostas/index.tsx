import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus,
  FileText,
  Loader2,
  FolderPlus,
  LayoutTemplate,
  LayoutList,
  LayoutGrid,
  Calendar,
  Building2,
  DollarSign,
  Search,
  Trash2,
  ArrowUpDown,
} from "lucide-react";
import { DialogDescription as DD, DialogFooter } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
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
import { formatCurrencyInput, parseCurrencyString } from "@/lib/currencyUtils";
import { CapacidadeSimulacao } from "./components/CapacidadeSimulacao";
import { TemplatesManager } from "./components/TemplatesManager";
import { GerarPropostaDialog } from "./components/GerarPropostaDialog";
import { PropostaDetailDialog } from "./components/PropostaDetailDialog";
import { fetchClientesLookup, fetchLeadsLookup } from "@/lib/supabaseQueries";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/usePageTitle";

interface PropostaDisciplina {
  id: string;
  disciplina: string;
  horas_estimadas: number | null;
  custo_hora: number | null;
}

type ViewMode = "table" | "cards";

const emptyForm: PropostaInsert = {
  titulo: "",
  codigo: "",
  area_m2: undefined,
  localizacao: "",
  valor_proposto: undefined,
  prazo_estimado_dias: undefined,
  observacao: "",
};

export default function Propostas() {
  usePageTitle("Documentos");
  const queryClient = useQueryClient();
  const { data: userRole } = useUserRole();
  const { data: propostas = [], isLoading } = usePropostas();
  const createProposta = useCreateProposta();
  const updateProposta = useUpdateProposta();
  const deleteProposta = useDeleteProposta();
  const converterProposta = useConverterProposta();
  const navigate = useNavigate();

  const canEdit = userRole === "admin" || userRole === "ultra_admin";
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [vinculoTipo, setVinculoTipo] = useState<"cliente" | "lead">("cliente");
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; titulo: string } | null>(null);
  const [convertPropostaId, setConvertPropostaId] = useState<string | null>(null);
  const [gerarDocxPropostaId, setGerarDocxPropostaId] = useState<string | null>(null);
  const [gerarContratoPropostaId, setGerarContratoPropostaId] = useState<string | null>(null);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [detailPropostaId, setDetailPropostaId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortField, setSortField] = useState<"titulo" | "valor_proposto" | "validade" | "created_at" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const detailProposta = propostas.find((p) => p.id === detailPropostaId) ?? null;
  const gerarDocxProposta = propostas.find((p) => p.id === gerarDocxPropostaId);
  const { data: gerarDocxDisciplinas = [] } = usePropostaDisciplinas(gerarDocxPropostaId);
  const gerarContratoProposta = propostas.find((p) => p.id === gerarContratoPropostaId);
  const { data: gerarContratoDisciplinas = [] } = usePropostaDisciplinas(gerarContratoPropostaId);
  const convertProposta = propostas.find((p) => p.id === convertPropostaId);
  const { data: convertDisciplinas = [] } = usePropostaDisciplinas(convertPropostaId);

  const [form, setForm] = useState<PropostaInsert>(emptyForm);
  const [valorDisplay, setValorDisplay] = useState("");

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-select"],
    queryFn: fetchClientesLookup,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads-select"],
    queryFn: fetchLeadsLookup,
  });

  const resetForm = () => {
    setForm(emptyForm);
    setValorDisplay("");
    setVinculoTipo("cliente");
    setEditingId(null);
  };

  const openEdit = (id: string) => {
    const p = propostas.find((x) => x.id === id);
    if (!p) return;
    setDetailPropostaId(null);
    setEditingId(id);
    setForm({
      titulo: p.titulo,
      codigo: p.codigo || "",
      area_m2: p.area_m2 ?? undefined,
      localizacao: p.localizacao || "",
      valor_proposto: p.valor_proposto ?? undefined,
      prazo_estimado_dias: p.prazo_estimado_dias ?? undefined,
      observacao: p.observacao || "",
      cliente_id: p.cliente_id || undefined,
      lead_id: p.lead_id || undefined,
    });
    setVinculoTipo(p.lead_id ? "lead" : "cliente");
    setValorDisplay(
      p.valor_proposto ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(p.valor_proposto) : ""
    );
    setIsFormOpen(true);
  };

  const handleSubmit = () => {
    if (!form.titulo.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    const valorProposto = parseCurrencyString(valorDisplay);
    const payload = { ...form, valor_proposto: valorProposto || undefined };

    if (editingId) {
      updateProposta.mutate(
        { id: editingId, ...payload },
        {
          onSuccess: () => {
            toast.success("Proposta atualizada");
            setIsFormOpen(false);
            resetForm();
          },
          onError: () => toast.error("Erro ao atualizar"),
        }
      );
    } else {
      createProposta.mutate(payload, {
        onSuccess: () => {
          toast.success("Proposta criada");
          setIsFormOpen(false);
          resetForm();
        },
        onError: () => toast.error("Erro ao criar"),
      });
    }
  };

  const handleStatusChange = (id: string, status: string) => {
    updateProposta.mutate(
      { id, status },
      {
        onSuccess: () => toast.success(`Proposta ${PROPOSTA_STATUS_CONFIG[status]?.label || status}`),
        onError: () => toast.error("Erro"),
      }
    );
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    deleteProposta.mutate(confirmDelete.id, {
      onSuccess: () => {
        toast.success("Proposta removida");
        setConfirmDelete(null);
        setDetailPropostaId(null);
      },
      onError: () => toast.error("Erro"),
    });
  };

  const handleConverterEmProjeto = () => {
    if (!convertPropostaId) return;
    converterProposta.mutate(convertPropostaId, {
      onSuccess: (projetoId) => {
        toast.success("Projeto criado!", {
          description: "A proposta foi convertida em projeto com orçamento pré-preenchido.",
        });
        setConvertPropostaId(null);
        navigate(`/projetos/${projetoId}`);
      },
      onError: () => toast.error("Erro na conversão"),
    });
  };

  const formatCurrency = (v: number | null) =>
    v ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : "—";

  const formatDate = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");

  const hoje = new Date().toISOString().slice(0, 10);

  const getDisplayStatus = (p: { status: string; validade: string | null }) => {
    if (p.validade && p.validade < hoje && (p.status === "rascunho" || p.status === "enviada")) {
      return "expirada";
    }
    return p.status;
  };

  const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filteredPropostas = useMemo(() => {
    const term = normalize(searchTerm.trim());
    let list = propostas.filter((p) => {
      if (term) {
        const haystack = normalize(`${p.titulo} ${p.codigo || ""} ${p.cliente_nome || ""} ${p.lead_nome || ""}`);
        if (!haystack.includes(term)) return false;
      }
      if (filterStatus !== "all" && getDisplayStatus(p) !== filterStatus) return false;
      return true;
    });
    if (sortField) {
      list = [...list].sort((a, b) => {
        const av = a[sortField] ?? "";
        const bv = b[sortField] ?? "";
        const cmp = String(av).localeCompare(String(bv), "pt-BR", { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propostas, searchTerm, filterStatus, sortField, sortDir, hoje]);

  const header = (
    <PageHeader title="Documentos" description="Gerencie propostas e contratos">
      <div className="flex items-center gap-2">
        <Button
          className="rounded-full bg-brand hover:bg-brand/90 text-ink transition-colors px-5 py-2.5 text-sm"
          onClick={() => setIsTemplatesOpen(true)}
        >
          <LayoutTemplate className="h-4 w-4 mr-1.5" />
          Gerenciar Templates
        </Button>
        {canEdit && (
          <Button
            className="rounded-full bg-brand hover:bg-brand/90 text-ink transition-colors px-5 py-2.5 text-sm"
            onClick={() => {
              resetForm();
              setIsFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Nova Proposta
          </Button>
        )}
      </div>
    </PageHeader>
  );

  if (isLoading) {
    return (
      <PageLayout header={header}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout header={header}>
      <Card className="rounded-2xl border border-black/5 bg-white w-full flex flex-col min-h-0">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-lg font-medium tracking-tight">Lista de Documentos</CardTitle>
              <CardDescription className="text-sm text-black/60 mt-1">
                Total de {filteredPropostas.length} de {propostas.length} proposta(s)
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Buscar por título, cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 pl-9 rounded-full text-sm"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 w-full sm:w-36 rounded-full text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="enviada">Enviada</SelectItem>
                  <SelectItem value="aceita">Aceita</SelectItem>
                  <SelectItem value="recusada">Recusada</SelectItem>
                  <SelectItem value="expirada">Expirada</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button
                  variant={viewMode === "table" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setViewMode("table")}
                  aria-label="Visualizar em tabela"
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "cards" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setViewMode("cards")}
                  aria-label="Visualizar em cards"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 min-h-0 p-0 pb-4">
          {propostas.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Nenhuma proposta cadastrada"
              description="Crie sua primeira proposta para começar."
            />
          ) : filteredPropostas.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nenhuma proposta encontrada"
              description="Ajuste os filtros para ver mais resultados."
              action={{
                label: "Limpar filtros",
                variant: "outline",
                onClick: () => {
                  setSearchTerm("");
                  setFilterStatus("all");
                },
              }}
            />
          ) : viewMode === "table" ? (
            <div className="overflow-x-auto overflow-y-auto w-full max-h-[calc(100svh-360px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 font-medium"
                        onClick={() => handleSort("titulo")}
                      >
                        Título <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>Cliente/Lead</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 font-medium"
                        onClick={() => handleSort("valor_proposto")}
                      >
                        Valor <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 font-medium"
                        onClick={() => handleSort("validade")}
                      >
                        Validade <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    {canEdit && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPropostas.map((p) => {
                    const displayStatus = getDisplayStatus(p);
                    return (
                      <TableRow
                        key={p.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => setDetailPropostaId(p.id)}
                      >
                        <TableCell className="py-4">
                          <p className="text-sm font-medium">{p.titulo}</p>
                          {p.codigo && <p className="text-[11px] text-muted-foreground font-mono">{p.codigo}</p>}
                        </TableCell>
                        <TableCell className="text-sm py-4">{p.cliente_nome || p.lead_nome || "—"}</TableCell>
                        <TableCell className="text-sm py-4 font-medium">{formatCurrency(p.valor_proposto)}</TableCell>
                        <TableCell className="text-sm py-4 text-center">
                          <Badge className={`text-xs ${PROPOSTA_STATUS_CONFIG[displayStatus]?.color || ""}`}>
                            {PROPOSTA_STATUS_CONFIG[displayStatus]?.label || displayStatus}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`text-sm py-4 ${p.validade && p.validade < hoje ? "text-red-500 font-medium" : ""}`}
                        >
                          {formatDate(p.validade)}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-right py-4">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDelete({ id: p.id, titulo: p.titulo });
                              }}
                              aria-label="Excluir proposta"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {filteredPropostas.map((p) => {
                const displayStatus = getDisplayStatus(p);
                const isExpired = p.validade && p.validade < hoje;
                return (
                  <Card
                    key={p.id}
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setDetailPropostaId(p.id)}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{p.titulo}</p>
                          {p.codigo && <p className="text-[11px] text-muted-foreground font-mono">{p.codigo}</p>}
                        </div>
                        <Badge
                          className={`text-[10px] flex-shrink-0 ${PROPOSTA_STATUS_CONFIG[displayStatus]?.color || ""}`}
                        >
                          {PROPOSTA_STATUS_CONFIG[displayStatus]?.label || displayStatus}
                        </Badge>
                      </div>

                      <div className="space-y-1.5">
                        {(p.cliente_nome || p.lead_nome) && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{p.cliente_nome || p.lead_nome}</span>
                          </div>
                        )}
                        {p.valor_proposto && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <DollarSign className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                            <span className="font-medium">{formatCurrency(p.valor_proposto)}</span>
                          </div>
                        )}
                        {p.validade && (
                          <div
                            className={`flex items-center gap-1.5 text-xs ${isExpired ? "text-red-500" : "text-muted-foreground"}`}
                          >
                            <Calendar className="h-3 w-3 flex-shrink-0" />
                            <span>{formatDate(p.validade)}</span>
                          </div>
                        )}
                      </div>

                      {canEdit && (
                        <div className="flex justify-end pt-1 border-t">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDelete({ id: p.id, titulo: p.titulo });
                            }}
                            aria-label="Excluir proposta"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sheet de Templates */}
      <Sheet open={isTemplatesOpen} onOpenChange={setIsTemplatesOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Gerenciar Templates</SheetTitle>
          </SheetHeader>
          <TemplatesManager />
        </SheetContent>
      </Sheet>

      {/* Modal de detalhes */}
      <PropostaDetailDialog
        open={!!detailPropostaId}
        onOpenChange={(open) => {
          if (!open) setDetailPropostaId(null);
        }}
        proposta={detailProposta}
        canEdit={canEdit}
        hoje={hoje}
        onEdit={() => detailPropostaId && openEdit(detailPropostaId)}
        onDelete={() => {
          if (detailPropostaId && detailProposta) {
            setConfirmDelete({ id: detailPropostaId, titulo: detailProposta.titulo });
          }
          setDetailPropostaId(null);
        }}
        onStatusChange={handleStatusChange}
        onGerarDocx={() => {
          setGerarDocxPropostaId(detailPropostaId);
          setDetailPropostaId(null);
        }}
        onGerarContrato={() => {
          if (detailPropostaId && detailProposta?.contrato_recusado) {
            updateProposta.mutate({ id: detailPropostaId, contrato_recusado: false } as never);
          }
          setGerarContratoPropostaId(detailPropostaId);
        }}
        onConverter={() => {
          setConvertPropostaId(detailPropostaId);
          setDetailPropostaId(null);
        }}
        onMarcarContratoAssinado={() => {
          if (detailPropostaId) {
            updateProposta.mutate({ id: detailPropostaId, contrato_assinado: true } as never);
          }
        }}
        onRecusarContrato={() => {
          if (detailPropostaId) {
            updateProposta.mutate({ id: detailPropostaId, contrato_recusado: true } as never, {
              onSuccess: () =>
                toast.info("Contrato recusado registrado.", {
                  description: "Gere um novo contrato quando estiver pronto para reenviar.",
                }),
            });
          }
        }}
        isUpdating={updateProposta.isPending}
      />

      {/* Dialog de criação / edição */}
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsFormOpen(false);
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Proposta" : "Nova Proposta"}</DialogTitle>
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
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <Label className="text-sm font-medium">Vincular a:</Label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="vinculo"
                      className="accent-primary"
                      checked={vinculoTipo === "cliente"}
                      onChange={() => {
                        setVinculoTipo("cliente");
                        setForm({ ...form, lead_id: undefined });
                      }}
                    />
                    Cliente existente
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="vinculo"
                      className="accent-primary"
                      checked={vinculoTipo === "lead"}
                      onChange={() => {
                        setVinculoTipo("lead");
                        setForm({ ...form, cliente_id: undefined });
                      }}
                    />
                    Lead (prospecto)
                  </label>
                </div>
              </div>
              {vinculoTipo === "lead" ? (
                <div className="space-y-1">
                  <Select
                    value={form.lead_id || ""}
                    onValueChange={(v) => setForm({ ...form, lead_id: v, cliente_id: undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o lead" />
                    </SelectTrigger>
                    <SelectContent>
                      {leads.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Ao converter em projeto, o lead será automaticamente promovido a cliente.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Select
                    value={form.cliente_id || ""}
                    onValueChange={(v) => setForm({ ...form, cliente_id: v, lead_id: undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Opcional. Você pode criar a proposta sem vínculo e associar depois.
                  </p>
                </div>
              )}
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
              <Button
                variant="outline"
                onClick={() => {
                  setIsFormOpen(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={createProposta.isPending || updateProposta.isPending}>
                {editingId ? "Salvar Alterações" : "Criar Proposta"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        title="Excluir Proposta"
        itemName={confirmDelete?.titulo}
        description="Esta ação não pode ser desfeita."
        onConfirm={handleDelete}
      />

      {/* Dialog Conversão Proposta → Projeto */}
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
            <DD>Um novo projeto será criado automaticamente com os dados desta proposta.</DD>
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
          onSent={() => {
            setGerarDocxPropostaId(null);
            handleStatusChange(gerarDocxProposta.id, "enviada");
          }}
        />
      )}

      {gerarContratoProposta && (
        <GerarPropostaDialog
          open={!!gerarContratoPropostaId}
          onOpenChange={(open) => {
            if (!open) setGerarContratoPropostaId(null);
          }}
          mode="contrato"
          proposta={gerarContratoProposta}
          disciplinas={gerarContratoDisciplinas.map((d: PropostaDisciplina) => ({
            disciplina: d.disciplina,
            horas_estimadas: Number(d.horas_estimadas),
            custo_hora: Number(d.custo_hora),
          }))}
          onSent={() => {
            queryClient.invalidateQueries({ queryKey: ["propostas"] });
            setGerarContratoPropostaId(null);
          }}
        />
      )}
    </PageLayout>
  );
}

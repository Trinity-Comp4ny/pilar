import { useState, useMemo, useEffect, useRef } from "react";
import { formatCurrency as fmtMoeda, formatDecimal } from "@/lib/format";
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
  MoreVertical,
  SlidersHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DialogDescription as DD, DialogFooter } from "@/components/ui/dialog";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  useRestoreProposta,
  useConverterProposta,
  usePropostaDisciplinas,
  useSalvarPropostaDisciplinas,
  PROPOSTA_STATUS_CONFIG,
  type PropostaInsert,
} from "@/hooks/usePropostas";
import { formatCurrencyInput, parseCurrencyString, formatCurrency as formatCurrencyBRL } from "@/lib/currencyUtils";
import { DisciplinasEditor } from "./components/DisciplinasEditor";
import { calcDisciplinasTotais, valorDivergeDaSoma, type DisciplinaLinha } from "./lib/disciplinasCalc";
import { DatePicker } from "@/components/ui/date-picker";
import { addDays, format } from "date-fns";
import { CapacidadeSimulacao } from "./components/CapacidadeSimulacao";
import { TemplatesManager } from "./components/TemplatesManager";
import { GerarPropostaDialog } from "./components/GerarPropostaDialog";
import { PropostaDetailDialog } from "./components/PropostaDetailDialog";
import { fetchClientesLookup, fetchLeadsLookup } from "@/lib/supabaseQueries";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useRegistrarPagina } from "@/hooks/useRecentes";
import { SmartInvoiceDialog } from "@/components/SmartInvoiceDialog";

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

// Sugere o próximo código sequencial no padrão PROP-001 a partir dos existentes.
// O usuário pode editar livremente.
const suggestNextCodigo = (list: { codigo: string | null }[]) => {
  let max = 0;
  for (const p of list) {
    const m = /^PROP-(\d+)$/i.exec((p.codigo || "").trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `PROP-${String(max + 1).padStart(3, "0")}`;
};

export default function Propostas() {
  usePageTitle("Propostas");
  useRegistrarPagina("pagina", "/documentos", "Documentos");
  const queryClient = useQueryClient();
  const { data: userRole } = useUserRole();
  const { data: propostas = [], isLoading } = usePropostas();
  const createProposta = useCreateProposta();
  const updateProposta = useUpdateProposta();
  const deleteProposta = useDeleteProposta();
  const restoreProposta = useRestoreProposta();
  const converterProposta = useConverterProposta();
  const salvarDisciplinas = useSalvarPropostaDisciplinas();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

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
  const [smartInvoice, setSmartInvoice] = useState<{
    projetoId: string;
    propostaValor: number;
    propostaNome: string;
  } | null>(null);
  const [detailPropostaId, setDetailPropostaId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCliente, setFilterCliente] = useState("all");
  const [filterTipo, setFilterTipo] = useState<"all" | "proposta" | "contrato">("all");
  const [filterDateField, setFilterDateField] = useState<"created_at" | "validade">("created_at");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
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
  const [disciplinasRows, setDisciplinasRows] = useState<DisciplinaLinha[]>([]);

  // Carrega as disciplinas da proposta em edição uma única vez por proposta,
  // sem sobrescrever o que o usuário já editou no formulário aberto.
  const { data: editDisciplinasData = [], isFetched: editDisciplinasFetched } = usePropostaDisciplinas(editingId);
  const hydratedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!editingId) {
      hydratedFor.current = null;
      return;
    }
    if (hydratedFor.current === editingId || !editDisciplinasFetched) return;
    setDisciplinasRows(
      editDisciplinasData.map((d) => ({
        id: d.id,
        disciplina: d.disciplina,
        horas_estimadas: Number(d.horas_estimadas) || 0,
        custo_hora: Number(d.custo_hora) || 0,
        valor_venda: Number(d.valor_venda) || 0,
      }))
    );
    hydratedFor.current = editingId;
  }, [editingId, editDisciplinasFetched, editDisciplinasData]);

  const disciplinasTotais = calcDisciplinasTotais(disciplinasRows);
  const valorPropostoNum = parseCurrencyString(valorDisplay);
  const valorDiverge = valorDivergeDaSoma(valorPropostoNum, disciplinasTotais.totalValor);

  const codigoTrim = (form.codigo || "").trim();
  const codigoDuplicado =
    codigoTrim.length > 0 &&
    propostas.some((p) => p.id !== editingId && (p.codigo || "").trim().toLowerCase() === codigoTrim.toLowerCase());

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
    setDisciplinasRows([]);
    hydratedFor.current = null;
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
      validade: p.validade || undefined,
      cliente_id: p.cliente_id || undefined,
      lead_id: p.lead_id || undefined,
    });
    setVinculoTipo(p.lead_id ? "lead" : "cliente");
    setValorDisplay(p.valor_proposto ? formatDecimal(p.valor_proposto) : "");
    setIsFormOpen(true);
  };

  // Deep-link ?edit=<id> (ex.: vindo de "Criar Proposta" no lead): abre o editor
  // assim que a proposta aparece na lista, depois limpa o parâmetro.
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId) return;
    if (!propostas.some((p) => p.id === editId)) return;
    openEdit(editId);
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, propostas]);

  const handleSubmit = () => {
    if (!form.titulo.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    if (codigoDuplicado) {
      toast.error("Já existe uma proposta com esse código");
      return;
    }
    const disciplinasValidas = disciplinasRows.filter((d) => d.disciplina.trim() !== "");
    // Se não há valor digitado, usa a soma das disciplinas como valor proposto.
    const valorManual = parseCurrencyString(valorDisplay);
    const valorProposto = valorManual || (disciplinasTotais.totalValor > 0 ? disciplinasTotais.totalValor : undefined);
    const payload = { ...form, valor_proposto: valorProposto };

    const disciplinasPayload = disciplinasValidas.map((d) => ({
      disciplina: d.disciplina.trim(),
      horas_estimadas: d.horas_estimadas,
      custo_hora: d.custo_hora,
      valor_venda: d.valor_venda,
    }));

    // Persiste as disciplinas via RPC transacional (delete + insert + recálculo de
    // custo/margem). Só chama quando há linhas ou quando estamos editando (para
    // refletir remoções). Falha aqui não invalida a proposta já salva.
    const persistDisciplinas = (propostaId: string, done: () => void) => {
      if (disciplinasPayload.length === 0 && !editingId) {
        done();
        return;
      }
      salvarDisciplinas.mutate(
        { propostaId, disciplinas: disciplinasPayload },
        {
          onSuccess: done,
          onError: () => {
            toast.error("Proposta salva, mas houve erro ao salvar as disciplinas");
            done();
          },
        }
      );
    };

    if (editingId) {
      updateProposta.mutate(
        { id: editingId, ...payload },
        {
          onSuccess: () => {
            persistDisciplinas(editingId, () => {
              toast.success("Proposta atualizada");
              setIsFormOpen(false);
              resetForm();
            });
          },
          onError: () => toast.error("Erro ao atualizar"),
        }
      );
    } else {
      // Default de validade: 30 dias a partir de hoje (data local, não UTC), para
      // a lógica de expiração ter uma data com que trabalhar desde a criação.
      const createPayload = {
        ...payload,
        validade: form.validade || format(addDays(new Date(), 30), "yyyy-MM-dd"),
      };
      createProposta.mutate(createPayload, {
        onSuccess: (data) => {
          persistDisciplinas(data.id, () => {
            toast.success("Proposta criada");
            setIsFormOpen(false);
            resetForm();
          });
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
    const { id, titulo } = confirmDelete;
    deleteProposta.mutate(id, {
      onSuccess: () => {
        toast.success("Proposta removida", {
          description: `"${titulo}" saiu da lista.`,
          action: {
            label: "Desfazer",
            onClick: () =>
              restoreProposta.mutate(id, {
                onSuccess: () => toast.success("Proposta restaurada"),
                onError: () => toast.error("Erro ao restaurar"),
              }),
          },
        });
        setConfirmDelete(null);
        setDetailPropostaId(null);
      },
      onError: () => toast.error("Erro ao remover"),
    });
  };

  const handleConverterEmProjeto = () => {
    if (!convertPropostaId) return;
    const proposta = propostas.find((p) => p.id === convertPropostaId);
    converterProposta.mutate(convertPropostaId, {
      onSuccess: (projetoId) => {
        toast.success("Projeto criado!", {
          description: "A proposta foi convertida em projeto com orçamento pré-preenchido.",
        });
        setConvertPropostaId(null);
        if (proposta) {
          setSmartInvoice({
            projetoId,
            propostaValor: proposta.valor_proposto ?? 0,
            propostaNome: proposta.titulo,
          });
        } else {
          navigate(`/projetos/${projetoId}`);
        }
      },
      onError: () => toast.error("Erro na conversão"),
    });
  };

  const formatCurrency = (v: number | null) => (v ? fmtMoeda(v) : "—");

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

  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
    setFilterCliente("all");
    setFilterTipo("all");
    setFilterDateField("created_at");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  // Contagem de filtros avançados ativos (fora status e busca, que têm controle próprio).
  const activeAdvancedFilters =
    (filterCliente !== "all" ? 1 : 0) + (filterTipo !== "all" ? 1 : 0) + (filterDateFrom || filterDateTo ? 1 : 0);

  const openDetail = (id: string) => setDetailPropostaId(id);
  const handleRowKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDetail(id);
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
      if (filterCliente !== "all" && p.cliente_id !== filterCliente) return false;
      if (filterTipo !== "all") {
        const isContrato = !!(p.contrato_enviado || p.contrato_assinado || p.contrato_recusado);
        if (filterTipo === "contrato" && !isContrato) return false;
        if (filterTipo === "proposta" && isContrato) return false;
      }
      if (filterDateFrom || filterDateTo) {
        const raw = filterDateField === "validade" ? p.validade : p.created_at;
        const d = raw ? raw.slice(0, 10) : "";
        if (!d) return false;
        if (filterDateFrom && d < filterDateFrom) return false;
        if (filterDateTo && d > filterDateTo) return false;
      }
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
  }, [
    propostas,
    searchTerm,
    filterStatus,
    filterCliente,
    filterTipo,
    filterDateField,
    filterDateFrom,
    filterDateTo,
    sortField,
    sortDir,
    hoje,
  ]);

  const header = (
    <PageHeader
      title="Documentos"
      search={{ value: searchTerm, onChange: setSearchTerm, placeholder: "Buscar por título ou cliente" }}
      primaryAction={{
        label: "Nova proposta",
        icon: Plus,
        feature: "propostas",
        onClick: () => {
          resetForm();
          setForm({ ...emptyForm, codigo: suggestNextCodigo(propostas) });
          setIsFormOpen(true);
        },
      }}
    >
      <Button variant="outline" className="rounded-full text-sm h-9" onClick={() => setIsTemplatesOpen(true)}>
        <LayoutTemplate className="h-4 w-4 mr-1.5" />
        Templates
      </Button>
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
              <CardTitle className="text-lg font-medium tracking-tight">Lista de Propostas</CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-1">
                Total de {filteredPropostas.length} de {propostas.length} proposta(s)
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {/* Busca de texto migrou para o PageHeader (spec 002). */}
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 rounded-full text-sm relative gap-1.5">
                    <SlidersHorizontal className="h-4 w-4" />
                    Filtros
                    {activeAdvancedFilters > 0 && (
                      <Badge className="ml-0.5 h-5 min-w-5 justify-center rounded-full bg-brand px-1.5 text-[11px] text-ink">
                        {activeAdvancedFilters}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cliente</Label>
                    <Select value={filterCliente} onValueChange={setFilterCliente}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Todos os clientes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os clientes</SelectItem>
                        {clientes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={filterTipo} onValueChange={(v) => setFilterTipo(v as typeof filterTipo)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os tipos</SelectItem>
                        <SelectItem value="proposta">Só propostas</SelectItem>
                        <SelectItem value="contrato">Com contrato</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs">Período</Label>
                      <Select
                        value={filterDateField}
                        onValueChange={(v) => setFilterDateField(v as typeof filterDateField)}
                      >
                        <SelectTrigger className="h-7 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="created_at">Criação</SelectItem>
                          <SelectItem value="validade">Validade</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <DatePicker value={filterDateFrom} onChange={setFilterDateFrom} placeholder="De" />
                      <DatePicker value={filterDateTo} onChange={setFilterDateTo} placeholder="Até" />
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={clearFilters}>
                    Limpar filtros
                  </Button>
                </PopoverContent>
              </Popover>
              <div className="flex items-center gap-1">
                <Button
                  variant={viewMode === "table" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-11 w-11"
                  onClick={() => setViewMode("table")}
                  aria-label="Visualizar em tabela"
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "cards" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-11 w-11"
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
                onClick: clearFilters,
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
                        className="-ml-3 h-11 font-medium text-xs"
                        onClick={() => handleSort("titulo")}
                      >
                        Título <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>Cliente/Lead</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        className="-ml-3 h-11 font-medium text-xs"
                        onClick={() => handleSort("valor_proposto")}
                      >
                        Valor <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        className="-ml-3 h-11 font-medium text-xs"
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
                        role="button"
                        tabIndex={0}
                        aria-label={`Ver detalhes da proposta ${p.titulo}`}
                        className="cursor-pointer hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                        onClick={() => openDetail(p.id)}
                        onKeyDown={(e) => handleRowKeyDown(e, p.id)}
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
                          className={`text-sm py-4 ${p.validade && p.validade < hoje ? "text-danger-mid font-medium" : ""}`}
                        >
                          {formatDate(p.validade)}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-right py-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-11 w-11 text-muted-foreground hover:text-foreground"
                                  aria-label="Mais opções"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setConfirmDelete({ id: p.id, titulo: p.titulo })}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
                    role="button"
                    tabIndex={0}
                    aria-label={`Ver detalhes da proposta ${p.titulo}`}
                    className="hover:shadow-md transition-shadow cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => openDetail(p.id)}
                    onKeyDown={(e) => handleRowKeyDown(e, p.id)}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{p.titulo}</p>
                          {p.codigo && <p className="text-[11px] text-muted-foreground font-mono">{p.codigo}</p>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Badge className={`text-[10px] ${PROPOSTA_STATUS_CONFIG[displayStatus]?.color || ""}`}>
                            {PROPOSTA_STATUS_CONFIG[displayStatus]?.label || displayStatus}
                          </Badge>
                          {canEdit && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-11 w-11 text-muted-foreground hover:text-foreground -mr-1"
                                  aria-label="Mais opções"
                                >
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setConfirmDelete({ id: p.id, titulo: p.titulo })}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
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
                            className={`flex items-center gap-1.5 text-xs ${isExpired ? "text-danger-mid" : "text-muted-foreground"}`}
                          >
                            <Calendar className="h-3 w-3 flex-shrink-0" />
                            <span>{formatDate(p.validade)}</span>
                          </div>
                        )}
                      </div>
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
                {codigoDuplicado && (
                  <p className="text-[11px] text-warning-mid">Já existe uma proposta com este código.</p>
                )}
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
              <fieldset className="flex flex-wrap items-center gap-4">
                <legend className="sr-only">Vincular a cliente ou lead</legend>
                <span className="text-sm font-medium">Vincular a:</span>
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
              </fieldset>
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
                  min={0}
                  value={form.prazo_estimado_dias || ""}
                  onChange={(e) => {
                    const n = parseInt(e.target.value);
                    setForm({ ...form, prazo_estimado_dias: Number.isNaN(n) ? undefined : Math.max(0, n) });
                  }}
                />
              </div>
            </div>

            {disciplinasTotais.totalValor > 0 && (
              <div className="flex flex-wrap items-center gap-2 -mt-2 text-[11px] text-muted-foreground">
                <span>Soma das disciplinas: {formatCurrencyBRL(disciplinasTotais.totalValor)}</span>
                {valorDiverge && (
                  <>
                    <span className="text-warning-mid">difere do valor digitado</span>
                    <button
                      type="button"
                      className="text-ink underline underline-offset-2"
                      onClick={() => setValorDisplay(formatDecimal(disciplinasTotais.totalValor))}
                    >
                      usar a soma
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Disciplinas</Label>
                <span className="text-[11px] text-muted-foreground">Opcional. Detalha horas, custo e valor.</span>
              </div>
              <DisciplinasEditor rows={disciplinasRows} onChange={setDisciplinasRows} disabled={!canEdit} />
            </div>

            <div className="space-y-2">
              <Label>Validade da proposta</Label>
              <DatePicker
                value={form.validade || ""}
                onChange={(v) => setForm({ ...form, validade: v || undefined })}
              />
              <p className="text-[11px] text-muted-foreground">
                Após esta data a proposta aparece como expirada. Padrão: 30 dias a partir da criação.
              </p>
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
              <Button
                variant="brand"
                onClick={handleSubmit}
                disabled={createProposta.isPending || updateProposta.isPending || salvarDisciplinas.isPending}
              >
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
        description="A proposta sai da lista. Você poderá restaurá-la logo em seguida pelo aviso de desfazer."
        confirmText="Excluir"
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
              <FolderPlus className="h-5 w-5 text-foreground" />
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
                        className="flex justify-between items-center text-xs bg-info-soft rounded px-3 py-1.5"
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

              <div className="text-xs text-muted-foreground bg-warning-soft border border-warning-mid-border rounded-lg p-3">
                O projeto será criado com status "Planejamento" e orçamento por disciplina pré-preenchido. Você poderá
                editar tudo depois.
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setConvertPropostaId(null)}>
              Cancelar
            </Button>
            <Button onClick={handleConverterEmProjeto} disabled={converterProposta.isPending} variant="brand">
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

      {/* SmartInvoiceDialog — aparece após converter proposta em projeto */}
      {smartInvoice && (
        <SmartInvoiceDialog
          open={!!smartInvoice}
          projetoId={smartInvoice.projetoId}
          propostaValor={smartInvoice.propostaValor}
          propostaNome={smartInvoice.propostaNome}
          onClose={() => {
            const destino = smartInvoice.projetoId;
            setSmartInvoice(null);
            navigate(`/projetos/${destino}`);
          }}
        />
      )}
    </PageLayout>
  );
}

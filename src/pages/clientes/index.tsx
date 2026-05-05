import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { monitoring } from "@/lib/monitoring";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  Search,
  ArrowUpDown,
  Mail,
  Trash2,
  Pencil,
  Landmark,
  X,
  Loader2,
  User,
  Check,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatPhone, formatDocument, formatAgency, formatBankAccount } from "@/lib/maskUtils";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";
import { Can } from "@/components/Can";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useClientes, type Cliente, type ContaBancaria, type ChavePix } from "@/hooks/useClientes";
import { detectTipoChavePix, normalizarChavePix, TIPO_CHAVE_PIX_LABEL } from "@/lib/pixUtils";
import { Badge } from "@/components/ui/badge";
import { ClienteMessageDialog } from "./ClienteMessageDialog";
import { EmptyState } from "@/components/EmptyState";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const fuzzyMatch = (text: string, query: string) => {
  const q = normalize(query);
  if (!q) return true;
  const t = normalize(text);
  let ti = 0;
  for (const qc of q) {
    ti = t.indexOf(qc, ti);
    if (ti === -1) return false;
    ti++;
  }
  return true;
};

export default function Clientes() {
  usePageTitle("Clientes");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { can } = usePermissions();
  const canShowActions = can("clientes", "edit");
  const { clientes, portalClienteIds, upsertCliente, isSaving, deleteCliente } = useClientes();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<{ id: string; nome: string } | null>(null);

  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [endereco, setEndereco] = useState("");
  const [contato, setContato] = useState("");
  const [email, setEmail] = useState("");
  const [tipoNf, setTipoNf] = useState("");
  const [origem, setOrigem] = useState("");
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [newConta, setNewConta] = useState({ banco: "", agencia: "", conta: "", tipo: "corrente" });
  const [chavesPix, setChavesPix] = useState<ChavePix[]>([]);
  const [newChavePix, setNewChavePix] = useState("");
  const [currentId, setCurrentId] = useState<string | null>(null);

  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (isDialogOpen) setStep(1);
  }, [isDialogOpen]);

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || clientes.length === 0) return;
    const target = clientes.find((c) => c.id === editId);
    if (target) {
      handleEditClick(target);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, clientes]);

  const goNext = () => {
    if (!nome.trim() || !cpfCnpj.trim()) {
      toast.error("Preencha nome e CPF/CNPJ para continuar");
      return;
    }
    setStep(2);
  };

  const goBack = () => setStep(1);

  const goToStep = (target: 1 | 2) => {
    if (isEditMode) {
      setStep(target);
      return;
    }
    if (target < step) {
      setStep(target);
      return;
    }
    if (target === 2) goNext();
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [filterOrigem, setFilterOrigem] = useState("all");
  const [filterPortal, setFilterPortal] = useState("all");

  // Message modal
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [selectedClienteForMessage, setSelectedClienteForMessage] = useState<Cliente | null>(null);
  const [messageText, setMessageText] = useState("");
  const [subjectText, setSubjectText] = useState("");

  // Send message handler
  const handleSendMessage = async () => {
    if (!selectedClienteForMessage || !messageText || !subjectText) return;

    try {
      const { error } = await supabase.functions.invoke("send-manual-client-email", {
        body: {
          email: selectedClienteForMessage?.email,
          subject: subjectText,
          message: messageText,
        },
      });

      if (error) {
        resetMessageModal();
        toast.error(
          `Erro ao enviar mensagem para ${selectedClienteForMessage?.nome}${selectedClienteForMessage?.sobrenome ? " " + selectedClienteForMessage.sobrenome : ""}`
        );
        monitoring.captureException(error, { context: "sendClientMessage" });
      }

      resetMessageModal();
      toast.success(
        `Mensagem enviada com sucesso para o cliente ${selectedClienteForMessage?.nome}${selectedClienteForMessage?.sobrenome ? " " + selectedClienteForMessage.sobrenome : ""}.`
      );
    } catch (error) {
      monitoring.captureException(error, { context: "sendClientMessage unexpected" });
    }
  };

  //Reset message modal
  const resetMessageModal = () => {
    setIsMessageModalOpen(false);
    setMessageText("");
    setSubjectText("");
    setSelectedClienteForMessage(null);
  };

  const [sortField, setSortField] = useState<keyof Cliente | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const resetForm = () => {
    setNome("");
    setSobrenome("");
    setCpfCnpj("");
    setEndereco("");
    setContato("");
    setEmail("");
    setTipoNf("");
    setOrigem("");
    setContasBancarias([]);
    setNewConta({ banco: "", agencia: "", conta: "", tipo: "corrente" });
    setChavesPix([]);
    setNewChavePix("");
    setCurrentId(null);
    setIsEditMode(false);
  };

  const handleOpenDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEditClick = (cliente: Cliente, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNome(cliente.nome);
    setSobrenome(cliente.sobrenome ?? "");
    setCpfCnpj(cliente.cpf_cnpj);
    setEndereco(cliente.endereco || "");
    setContato(cliente.contato || "");
    setEmail(cliente.email || "");
    setTipoNf(cliente.tipo_nf || "");
    setOrigem(cliente.origem || "");
    setContasBancarias(Array.isArray(cliente.contas_bancarias) ? cliente.contas_bancarias : []);
    setNewConta({ banco: "", agencia: "", conta: "", tipo: "corrente" });
    setChavesPix(Array.isArray(cliente.chaves_pix) ? cliente.chaves_pix : []);
    setNewChavePix("");
    setCurrentId(cliente.id);
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const handleAddConta = () => {
    if (!newConta.banco || !newConta.agencia || !newConta.conta) {
      toast.error("Dados incompletos", { description: "Preencha banco, agência e conta antes de adicionar" });
      return;
    }
    const isFirst = contasBancarias.length === 0;
    setContasBancarias((prev) => [...prev, { ...newConta, is_primary: isFirst }]);
    setNewConta({ banco: "", agencia: "", conta: "", tipo: "corrente" });
  };

  const handleAddChavePix = () => {
    const raw = newChavePix.trim();
    if (!raw) return;
    const tipo = detectTipoChavePix(raw);
    if (!tipo) {
      toast.error("Chave inválida", { description: "Formato não reconhecido como chave PIX" });
      return;
    }
    const chave = normalizarChavePix(raw, tipo);
    if (chavesPix.some((c) => c.chave === chave)) {
      toast.error("Chave duplicada", { description: "Esta chave já foi adicionada" });
      return;
    }
    setChavesPix((prev) => [...prev, { chave, tipo }]);
    setNewChavePix("");
  };

  const handleRemoveChavePix = (index: number) => {
    setChavesPix((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSetPrimaryConta = (index: number) => {
    setContasBancarias((prev) =>
      prev.map((conta, i) => ({
        ...conta,
        is_primary: i === index,
      }))
    );
  };

  const handleRemoveConta = (index: number) => {
    setContasBancarias((prev) => {
      const newContas = prev.filter((_, i) => i !== index);
      if (prev[index].is_primary && newContas.length > 0) {
        newContas[0].is_primary = true;
      }
      return newContas;
    });
  };

  const handleSave = async () => {
    if (!nome || !cpfCnpj || !email || !contato) {
      toast.error("Campos obrigatórios", { description: "Preencha nome, CPF/CNPJ, e-mail e contato" });
      return;
    }

    try {
      await upsertCliente({
        id: isEditMode && currentId ? currentId : undefined,
        data: {
          nome,
          sobrenome,
          cpf_cnpj: cpfCnpj,
          endereco,
          contato,
          email,
          tipo_nf: tipoNf,
          origem,
          contas_bancarias: contasBancarias,
          chaves_pix: chavesPix,
        },
      });

      resetForm();
      setIsDialogOpen(false);
    } catch (err) {
      monitoring.captureException(err, { context: "handleSaveCliente" });
    }
  };

  const handleDeleteClick = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const cliente = clientes.find((c) => c.id === id);
    const nomeCompleto = cliente ? `${cliente.nome}${cliente.sobrenome ? " " + cliente.sobrenome : ""}` : "Cliente";
    setClienteToDelete({ id, nome: nomeCompleto });
    setConfirmDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!clienteToDelete) return;
    try {
      await deleteCliente(clienteToDelete.id);
    } catch (err) {
      monitoring.captureException(err, { context: "handleDeleteCliente" });
    }
    setConfirmDeleteOpen(false);
    setClienteToDelete(null);
  };

  const handleSort = (field: keyof Cliente) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleRowClick = (cliente: Cliente) => {
    navigate(`/clientes/${cliente.id}`);
  };

  const origens = useMemo(
    () => Array.from(new Set(clientes.map((c) => c.origem).filter(Boolean))) as string[],
    [clientes]
  );

  const filteredAndSortedClientes = useMemo(() => {
    const term = searchTerm.trim();
    const filtered = clientes.filter((cliente) => {
      if (term) {
        const digits = cliente.cpf_cnpj ? cliente.cpf_cnpj.replace(/\D/g, "") : "";
        const termDigits = term.replace(/\D/g, "");
        const nomeCompleto = `${cliente.nome}${cliente.sobrenome ? " " + cliente.sobrenome : ""}`;
        const matchSearch = fuzzyMatch(nomeCompleto, term) || (termDigits && digits.includes(termDigits));
        if (!matchSearch) return false;
      }
      if (filterOrigem !== "all" && cliente.origem !== filterOrigem) return false;
      if (filterPortal === "com" && !portalClienteIds.has(cliente.id)) return false;
      if (filterPortal === "sem" && portalClienteIds.has(cliente.id)) return false;
      return true;
    });

    if (sortField) {
      filtered.sort((a, b) => {
        const aValue = a[sortField] || "";
        const bValue = b[sortField] || "";
        const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return filtered;
  }, [clientes, searchTerm, filterOrigem, filterPortal, portalClienteIds, sortField, sortDirection]);

  return (
    <PageLayout
      className="overflow-y-hidden"
      containerClassName="h-full flex flex-col min-h-0"
      header={
        <PageHeader
          title="Clientes"
          description="Gerencie seus clientes"
          children={
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <Can feature="clientes" action="create">
                <DialogTrigger asChild>
                  <Button
                    className="rounded-full bg-brand hover:bg-brand/90 text-ink transition-colors px-5 py-2.5 text-sm"
                    onClick={handleOpenDialog}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Cliente
                  </Button>
                </DialogTrigger>
              </Can>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
                <div className="px-6 pt-6 pb-4 border-b">
                  <DialogHeader>
                    <DialogTitle>{isEditMode ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
                    <DialogDescription>
                      {isEditMode ? "Atualize os dados do cliente" : "Cadastre um novo cliente no sistema"}
                    </DialogDescription>
                  </DialogHeader>
                </div>

                {/* Stepper */}
                {(() => {
                  const STEPS = [
                    { id: 1 as const, label: "Identificação", icon: User, desc: "Dados do cliente" },
                    { id: 2 as const, label: "Financeiro", icon: Landmark, desc: "Contas e chaves PIX" },
                  ];
                  return (
                    <div className="flex items-center gap-1 px-6 py-3 border-b">
                      {STEPS.map((s, i) => {
                        const Icon = s.icon;
                        const isActive = step === s.id;
                        const isCompleted = step > s.id;
                        const isClickable = isEditMode || s.id <= step;
                        return (
                          <div key={s.id} className="flex items-center flex-1">
                            <button
                              type="button"
                              onClick={() => isClickable && goToStep(s.id)}
                              disabled={!isClickable}
                              className={cn(
                                "flex items-center gap-2 flex-1 p-2 rounded-lg transition-colors text-left",
                                isClickable && "hover:bg-muted",
                                !isClickable && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <span
                                className={cn(
                                  "h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold",
                                  isActive && "bg-brand text-ink",
                                  isCompleted && "bg-brand text-ink",
                                  !isActive && !isCompleted && "bg-muted text-muted-foreground"
                                )}
                              >
                                {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                              </span>
                              <div className="hidden sm:block min-w-0">
                                <p
                                  className={cn(
                                    "text-xs font-medium truncate",
                                    isActive ? "text-foreground" : "text-muted-foreground"
                                  )}
                                >
                                  {s.label}
                                </p>
                                <p className="text-[10px] text-muted-foreground">Passo {s.id}</p>
                              </div>
                            </button>
                            {i < STEPS.length - 1 && (
                              <div className={cn("h-px flex-1 mx-1", step > s.id ? "bg-brand" : "bg-muted")} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                <form onSubmit={(e) => e.preventDefault()} className="divide-y">
                  {step === 1 && (
                    <>
                      {/* Identificação */}
                      <div className="px-6 py-4 space-y-3">
                        <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">
                          Identificação
                        </Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="nome" className="text-xs">
                              Nome / Razão Social *
                            </Label>
                            <Input
                              id="nome"
                              value={nome}
                              onChange={(e) => setNome(e.target.value)}
                              placeholder="Primeiro nome ou razão social"
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="sobrenome" className="text-xs">
                              Sobrenome
                            </Label>
                            <Input
                              id="sobrenome"
                              value={sobrenome}
                              onChange={(e) => setSobrenome(e.target.value)}
                              placeholder="Sobrenome"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="cpf" className="text-xs">
                              CPF/CNPJ *
                            </Label>
                            <Input
                              id="cpf"
                              value={cpfCnpj}
                              onChange={(e) => setCpfCnpj(formatDocument(e.target.value))}
                              placeholder="000.000.000-00"
                              maxLength={18}
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-xs">
                              Email *
                            </Label>
                            <Input
                              id="email"
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="email@exemplo.com"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="contato" className="text-xs">
                              Contato *
                            </Label>
                            <Input
                              id="contato"
                              value={contato}
                              onChange={(e) => setContato(formatPhone(e.target.value))}
                              maxLength={15}
                              placeholder="(14) 99999-9999"
                            />
                          </div>
                          <div className="md:col-span-2 space-y-1.5">
                            <Label htmlFor="endereco" className="text-xs">
                              Endereço
                            </Label>
                            <Input
                              id="endereco"
                              value={endereco}
                              onChange={(e) => setEndereco(e.target.value)}
                              placeholder="Endereço completo"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Comercial */}
                      <div className="px-6 py-4 space-y-3">
                        <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Comercial</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="tipoNf" className="text-xs">
                              Tipo de Nota Fiscal
                            </Label>
                            <Select value={tipoNf} onValueChange={setTipoNf}>
                              <SelectTrigger id="tipoNf">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="servico">Serviço</SelectItem>
                                <SelectItem value="produto">Produto</SelectItem>
                                <SelectItem value="misto">Misto</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="origem" className="text-xs">
                              Origem
                            </Label>
                            <Input
                              id="origem"
                              value={origem}
                              onChange={(e) => setOrigem(e.target.value)}
                              placeholder="Ex: Indicação, Instagram, Site"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      {/* Contas Bancárias */}
                      <div className="px-6 py-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">
                            Contas Bancárias
                          </Label>
                          <span className="text-[10px] text-muted-foreground">Para recebimento</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                          <div className="space-y-1">
                            <Label className="text-xs">Banco</Label>
                            <Input
                              placeholder="Nome do banco"
                              value={newConta.banco}
                              onChange={(e) => setNewConta({ ...newConta, banco: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Agência</Label>
                            <Input
                              placeholder="0000"
                              value={newConta.agencia}
                              onChange={(e) => setNewConta({ ...newConta, agencia: formatAgency(e.target.value) })}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Conta</Label>
                            <Input
                              placeholder="000000-0"
                              value={newConta.conta}
                              onChange={(e) => setNewConta({ ...newConta, conta: formatBankAccount(e.target.value) })}
                            />
                          </div>
                          <div className="flex items-end gap-2">
                            <Select
                              value={newConta.tipo}
                              onValueChange={(value) => setNewConta({ ...newConta, tipo: value })}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="corrente">Corrente</SelectItem>
                                <SelectItem value="poupanca">Poupança</SelectItem>
                                <SelectItem value="pj">PJ</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-9 w-9 shrink-0"
                              onClick={handleAddConta}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {contasBancarias.length > 0 && (
                          <div className="space-y-1.5">
                            {contasBancarias.map((conta, index) => (
                              <div
                                key={index}
                                className={`flex items-center justify-between gap-3 border rounded-lg px-3 py-2 text-sm ${conta.is_primary ? "border-brand/40" : ""}`}
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <button
                                    type="button"
                                    className="shrink-0"
                                    onClick={() => handleSetPrimaryConta(index)}
                                    title="Definir como principal"
                                  >
                                    <Landmark
                                      className={`h-4 w-4 ${conta.is_primary ? "text-brand" : "text-muted-foreground/40"}`}
                                    />
                                  </button>
                                  <span className="font-medium truncate">{conta.banco}</span>
                                  <span className="hidden md:inline text-xs text-muted-foreground shrink-0">
                                    Ag. {conta.agencia} / Cc. {conta.conta}
                                  </span>
                                  <span className="text-xs text-muted-foreground capitalize shrink-0">
                                    {conta.tipo}
                                  </span>
                                  {conta.is_primary && (
                                    <span className="text-[10px] text-brand font-medium">Principal</span>
                                  )}
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-500 shrink-0"
                                  onClick={() => handleRemoveConta(index)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Chaves PIX */}
                      <div className="px-6 py-4 space-y-3">
                        <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Chaves PIX</Label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input
                              placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória"
                              value={newChavePix}
                              onChange={(e) => setNewChavePix(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddChavePix())}
                            />
                            {newChavePix && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                                {(() => {
                                  const t = detectTipoChavePix(newChavePix);
                                  return t ? TIPO_CHAVE_PIX_LABEL[t] : "...";
                                })()}
                              </span>
                            )}
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-9 w-9 shrink-0"
                            onClick={handleAddChavePix}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        {chavesPix.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {chavesPix.map((c, i) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="flex items-center gap-1.5 pl-2 pr-1 py-1 text-xs"
                              >
                                <select
                                  value={c.tipo}
                                  onChange={(e) =>
                                    setChavesPix((prev) =>
                                      prev.map((item, idx) => (idx === i ? { ...item, tipo: e.target.value } : item))
                                    )
                                  }
                                  className="text-[10px] text-muted-foreground bg-transparent border-none outline-none cursor-pointer hover:text-foreground transition-colors appearance-none"
                                >
                                  {Object.entries(TIPO_CHAVE_PIX_LABEL).map(([value, label]) => (
                                    <option key={value} value={value}>
                                      {label}
                                    </option>
                                  ))}
                                </select>
                                <span className="font-medium">{c.chave}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveChavePix(i)}
                                  className="ml-0.5 hover:text-red-500"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Footer */}
                  <div className="flex items-center gap-2 px-6 py-4 bg-gray-50/30">
                    <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                      Cancelar
                    </Button>
                    <div className="flex-1" />
                    {step === 2 && (
                      <Button type="button" variant="outline" onClick={goBack} disabled={isSaving}>
                        Voltar
                      </Button>
                    )}
                    {step === 1 && !isEditMode ? (
                      <Button type="button" onClick={goNext} className="bg-brand hover:bg-brand/90 text-ink">
                        Próximo →
                      </Button>
                    ) : step === 1 && isEditMode ? (
                      <>
                        <Button type="button" onClick={goNext} variant="outline">
                          Próximo →
                        </Button>
                        <Button
                          type="button"
                          onClick={handleSave}
                          className="bg-brand hover:bg-brand/90 text-ink"
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                            </>
                          ) : (
                            "Atualizar"
                          )}
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        onClick={handleSave}
                        className="bg-brand hover:bg-brand/90 text-ink"
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                          </>
                        ) : isEditMode ? (
                          "Atualizar"
                        ) : (
                          "Salvar"
                        )}
                      </Button>
                    )}
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          }
        />
      }
    >
      <Card className="rounded-2xl border border-black/5 bg-white w-full flex flex-col min-h-0">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-lg font-medium tracking-tight">Lista de Clientes</CardTitle>
              <CardDescription className="text-sm text-black/60 mt-1">
                Total de {filteredAndSortedClientes.length} de {clientes.length} cliente(s)
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40" />
                <Input
                  placeholder="Buscar por nome ou CPF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-50 border-gray-200"
                />
              </div>
              {origens.length > 0 && (
                <Select value={filterOrigem} onValueChange={setFilterOrigem}>
                  <SelectTrigger className="w-full sm:w-36 bg-gray-50 border-gray-200">
                    <SelectValue placeholder="Origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas origens</SelectItem>
                    {origens.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={filterPortal} onValueChange={setFilterPortal}>
                <SelectTrigger className="w-full sm:w-36 bg-gray-50 border-gray-200">
                  <SelectValue placeholder="Portal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="com">Com portal</SelectItem>
                  <SelectItem value="sem">Sem portal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0">
          <div className="overflow-x-auto overflow-y-auto w-full max-h-[calc(100svh-240px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort("nome")}
                      className="-ml-3 h-8 font-medium"
                    >
                      Nome
                      <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort("cpf_cnpj")}
                      className="-ml-3 h-8 font-medium"
                    >
                      CPF/CNPJ
                      <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">Contato</TableHead>
                  {canShowActions && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedClientes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canShowActions ? 5 : 4}>
                      {clientes.length === 0 ? (
                        <EmptyState
                          icon={UsersRound}
                          title="Nenhum cliente cadastrado"
                          description="Crie o primeiro cliente para começar."
                          action={
                            can("clientes", "create") ? { label: "Novo Cliente", onClick: handleOpenDialog } : undefined
                          }
                        />
                      ) : (
                        <EmptyState
                          icon={UsersRound}
                          title="Nenhum resultado encontrado"
                          description="Tente ajustar os filtros aplicados."
                          action={{
                            label: "Limpar filtros",
                            variant: "outline",
                            onClick: () => {
                              setSearchTerm("");
                              setFilterOrigem("all");
                              setFilterPortal("all");
                            },
                          }}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedClientes.map((cliente) => (
                    <TableRow
                      key={cliente.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleRowClick(cliente)}
                    >
                      <TableCell className="font-medium">
                        {cliente.nome}
                        {cliente.sobrenome ? ` ${cliente.sobrenome}` : ""}
                      </TableCell>
                      <TableCell>{formatDocument(cliente.cpf_cnpj)}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-black/70">{cliente.email}</TableCell>
                      <TableCell className="hidden lg:table-cell">{cliente.contato}</TableCell>
                      {canShowActions && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedClienteForMessage(cliente);
                                setIsMessageModalOpen(true);
                              }}
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => handleEditClick(cliente, e)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Can feature="clientes" action="delete">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500"
                                onClick={(e) => handleDeleteClick(cliente.id, e)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </Can>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ClienteMessageDialog
        open={isMessageModalOpen}
        cliente={selectedClienteForMessage}
        subject={subjectText}
        message={messageText}
        onSubjectChange={setSubjectText}
        onMessageChange={setMessageText}
        onCancel={resetMessageModal}
        onSend={handleSendMessage}
        onOpenChange={setIsMessageModalOpen}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        onConfirm={handleDeleteConfirm}
        title="Excluir Cliente"
        itemName={clienteToDelete?.nome}
        description="Esta ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </PageLayout>
  );
}

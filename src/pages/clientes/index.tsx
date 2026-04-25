import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  User,
  Mail,
  Phone,
  MapPin,
  Trash2,
  Pencil,
  Landmark,
  X,
  Loader2,
  Globe,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { formatPhone, formatDocument, formatAgency, formatBankAccount } from "@/lib/maskUtils";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";
import { Can } from "@/components/Can";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useClientes, type Cliente, type ContaBancaria } from "@/hooks/useClientes";
import { useRequireAal2 } from "@/hooks/useRequireAal2";
import { ClienteMessageDialog } from "./ClienteMessageDialog";
import { ClienteDetailDialog } from "./ClienteDetailDialog";

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
  const { can, isAdmin } = usePermissions();
  const canShowActions = can("clientes", "edit");
  const requireAal2 = useRequireAal2();

  const {
    clientes,
    upsertCliente,
    isSaving,
    deleteCliente,
    checkPortalAccess,
    invitePortal,
    isInvitingPortal,
    resetPortalPassword,
    isResettingPortal,
  } = useClientes();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [endereco, setEndereco] = useState("");
  const [contato, setContato] = useState("");
  const [email, setEmail] = useState("");
  const [tipoNf, setTipoNf] = useState("");
  const [origem, setOrigem] = useState("");
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [newConta, setNewConta] = useState({ banco: "", agencia: "", conta: "", tipo: "corrente" });
  const [currentId, setCurrentId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");

  // Portal do Cliente
  const [portalStatus, setPortalStatus] = useState<"idle" | "loading" | "exists" | "none">("idle");
  const [portalCredentials, setPortalCredentials] = useState<{ email: string; senha: string } | null>(null);
  const [resetCredentials, setResetCredentials] = useState<{ email: string; senha: string } | null>(null);

  // Message modal
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [selectedClienteForMessage, setSelectedClienteForMessage] = useState<Cliente | null>(null);
  const [messageText, setMessageText] = useState("");
  const [subjectText, setSubjectText] = useState("");

  // Send message handler
  const handleSendMessage = async () => {
    if (!selectedClienteForMessage || !messageText || !subjectText) return;

    try {
      const { data, error } = await supabase.functions.invoke("send-manual-client-email", {
        body: {
          email: selectedClienteForMessage?.email,
          subject: subjectText,
          message: messageText,
        },
      });

      if (error) {
        resetMessageModal();
        toast.error(`Erro ao enviar mensagem para ${selectedClienteForMessage?.nome}`);
        console.error(`Erro na função: ${error.message}`);
      }

      resetMessageModal();
      toast.success(`Mensagem enviada com sucesso para o cliente ${selectedClienteForMessage?.nome}.`);
    } catch (error) {
      console.error("Erro desconhecido:", error);
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
    setCpfCnpj("");
    setEndereco("");
    setContato("");
    setEmail("");
    setTipoNf("");
    setOrigem("");
    setContasBancarias([]);
    setNewConta({ banco: "", agencia: "", conta: "", tipo: "corrente" });
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
    setCpfCnpj(cliente.cpf_cnpj);
    setEndereco(cliente.endereco || "");
    setContato(cliente.contato || "");
    setEmail(cliente.email || "");
    setTipoNf(cliente.tipo_nf || "");
    setOrigem(cliente.origem || "");
    setContasBancarias(Array.isArray(cliente.contas_bancarias) ? cliente.contas_bancarias : []);
    setNewConta({ banco: "", agencia: "", conta: "", tipo: "corrente" });
    setCurrentId(cliente.id);
    setIsEditMode(true);
    setIsDialogOpen(true);
    setIsDetailOpen(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome || !cpfCnpj) {
      toast.error("Campos obrigatórios", { description: "Preencha pelo menos nome e CPF/CNPJ" });
      return;
    }

    try {
      await upsertCliente({
        id: isEditMode && currentId ? currentId : undefined,
        data: {
          nome,
          cpf_cnpj: cpfCnpj,
          endereco,
          contato,
          email,
          tipo_nf: tipoNf,
          origem,
          contas_bancarias: contasBancarias,
        },
      });

      resetForm();
      setIsDialogOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteClick = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setClienteToDelete(id);
    setConfirmDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!clienteToDelete) return;
    try {
      await deleteCliente(clienteToDelete);
      setIsDetailOpen(false);
    } catch (err) {
      console.error(err);
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
    setSelectedCliente(cliente);
    setIsDetailOpen(true);
    setPortalCredentials(null);
    setResetCredentials(null);
    // Verifica se já tem acesso ao portal
    setPortalStatus("loading");
    checkPortalAccess(cliente.id)
      .then((exists) => setPortalStatus(exists ? "exists" : "none"))
      .catch(() => setPortalStatus("none"));
  };

  const handleInvitePortal = async () => {
    if (!selectedCliente?.email) return;
    if (!(await requireAal2())) return;
    try {
      const credentials = await invitePortal({
        clienteId: selectedCliente.id,
        email: selectedCliente.email,
      });
      setPortalCredentials(credentials);
      setPortalStatus("exists");
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetPortalPassword = async () => {
    if (!selectedCliente) return;
    if (!(await requireAal2())) return;
    try {
      const credentials = await resetPortalPassword(selectedCliente.id);
      setResetCredentials(credentials);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredAndSortedClientes = useMemo(() => {
    const term = searchTerm.trim();
    const filtered = clientes.filter((cliente) => {
      if (!term) return true;
      const digits = cliente.cpf_cnpj ? cliente.cpf_cnpj.replace(/\D/g, "") : "";
      const termDigits = term.replace(/\D/g, "");

      return fuzzyMatch(cliente.nome, term) || (termDigits && digits.includes(termDigits));
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
  }, [clientes, searchTerm, sortField, sortDirection]);

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
                    className="rounded-full bg-accent-orange hover:bg-accent-orange/90 text-ink transition-colors px-5 py-2.5 text-sm"
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

                <form onSubmit={handleSubmit} className="divide-y">
                  {/* Identificação */}
                  <div className="px-6 py-4 space-y-3">
                    <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Identificação</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="nome" className="text-xs">
                          Nome *
                        </Label>
                        <Input
                          id="nome"
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          placeholder="Nome completo ou razão social"
                          required
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
                          Email
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
                          Contato
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
                            className={`flex items-center justify-between gap-3 border rounded-lg px-3 py-2 text-sm ${conta.is_primary ? "border-accent-orange/40" : ""}`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <button
                                type="button"
                                className="shrink-0"
                                onClick={() => handleSetPrimaryConta(index)}
                                title="Definir como principal"
                              >
                                <Landmark
                                  className={`h-4 w-4 ${conta.is_primary ? "text-accent-orange" : "text-muted-foreground/40"}`}
                                />
                              </button>
                              <span className="font-medium truncate">{conta.banco}</span>
                              <span className="hidden md:inline text-xs text-muted-foreground shrink-0">
                                Ag. {conta.agencia} / Cc. {conta.conta}
                              </span>
                              <span className="text-xs text-muted-foreground capitalize shrink-0">{conta.tipo}</span>
                              {conta.is_primary && (
                                <span className="text-[10px] text-accent-orange font-medium">Principal</span>
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

                  {/* Footer */}
                  <div className="flex gap-2 px-6 py-4 bg-gray-50/30">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                      className="flex-1"
                      disabled={isSaving}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-accent-orange hover:bg-accent-orange/90 text-ink"
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
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40" />
              <Input
                placeholder="Buscar por nome ou CPF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-50 border-gray-200"
              />
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
                    <TableCell colSpan={canShowActions ? 5 : 4} className="text-center text-black/50 py-8">
                      Nenhum cliente encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedClientes.map((cliente) => (
                    <TableRow
                      key={cliente.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleRowClick(cliente)}
                    >
                      <TableCell className="font-medium">{cliente.nome}</TableCell>
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

      <ClienteDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        cliente={selectedCliente}
        isAdmin={isAdmin}
        portalStatus={portalStatus}
        portalCredentials={portalCredentials}
        resetCredentials={resetCredentials}
        isInvitingPortal={isInvitingPortal}
        isResettingPortal={isResettingPortal}
        onInvitePortal={handleInvitePortal}
        onResetPortalPassword={handleResetPortalPassword}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
        onClose={() => setIsDetailOpen(false)}
      />

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
        description="Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </PageLayout>
  );
}

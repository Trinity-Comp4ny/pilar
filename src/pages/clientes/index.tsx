import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { monitoring } from "@/lib/monitoring";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Mail,
  Trash2,
  Pencil,
  UsersRound,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatDocument, onlyDigits } from "@/lib/maskUtils";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";
import { Can } from "@/components/Can";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useClientes, type Cliente } from "@/hooks/useClientes";
import { Skeleton } from "@/components/ui/skeleton";
import { ClienteMessageDialog } from "./ClienteMessageDialog";
import { ClienteFormDialog } from "./ClienteFormDialog";
import { EmptyState } from "@/components/EmptyState";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
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

// PF/PJ: usa a coluna explícita e, quando ausente, infere pelo documento.
const getTipoPessoa = (cliente: Cliente): "PF" | "PJ" | null => {
  if (cliente.tipo_pessoa === "PF" || cliente.tipo_pessoa === "PJ") return cliente.tipo_pessoa;
  const digits = onlyDigits(cliente.cpf_cnpj ?? "");
  if (digits.length === 14) return "PJ";
  if (digits.length === 11) return "PF";
  return null;
};

export default function Clientes() {
  usePageTitle("Clientes");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { can } = usePermissions();
  const canShowActions = can("clientes", "edit");
  const { clientes, isLoading, isError, refetch, portalClienteIds, clienteIdsComProjeto, deleteCliente } =
    useClientes();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<{ id: string; nome: string } | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterOrigem, setFilterOrigem] = useState("all");
  const [filterPortal, setFilterPortal] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterProjeto, setFilterProjeto] = useState("all");

  // Message modal
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [selectedClienteForMessage, setSelectedClienteForMessage] = useState<Cliente | null>(null);
  const [messageText, setMessageText] = useState("");
  const [subjectText, setSubjectText] = useState("");

  const [sortField, setSortField] = useState<keyof Cliente | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleOpenCreate = () => {
    setEditingCliente(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (cliente: Cliente, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingCliente(cliente);
    setIsDialogOpen(true);
  };

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || clientes.length === 0) return;
    const target = clientes.find((c) => c.id === editId);
    if (target) {
      setEditingCliente(target);
      setIsDialogOpen(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, clientes]);

  const handleSendMessage = async () => {
    if (!selectedClienteForMessage || !messageText || !subjectText) return;
    const nomeCompleto = `${selectedClienteForMessage.nome}${selectedClienteForMessage.sobrenome ? " " + selectedClienteForMessage.sobrenome : ""}`;
    try {
      const { error } = await supabase.functions.invoke("send-manual-client-email", {
        body: {
          email: selectedClienteForMessage.email,
          subject: subjectText,
          message: messageText,
        },
      });

      if (error) {
        resetMessageModal();
        toast.error(`Erro ao enviar mensagem para ${nomeCompleto}`);
        monitoring.captureException(error, { context: "sendClientMessage" });
        return;
      }

      resetMessageModal();
      toast.success(`Mensagem enviada com sucesso para o cliente ${nomeCompleto}.`);
    } catch (error) {
      monitoring.captureException(error, { context: "sendClientMessage unexpected" });
    }
  };

  const resetMessageModal = () => {
    setIsMessageModalOpen(false);
    setMessageText("");
    setSubjectText("");
    setSelectedClienteForMessage(null);
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

  const renderSortIcon = (field: keyof Cliente) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-3 w-3 text-muted-foreground/50" />;
    return sortDirection === "asc" ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />;
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
        const matchNome = fuzzyMatch(nomeCompleto, term);
        const matchDoc = termDigits.length > 0 && digits.includes(termDigits);
        const matchEmail = cliente.email ? normalize(cliente.email).includes(normalize(term)) : false;
        if (!matchNome && !matchDoc && !matchEmail) return false;
      }
      if (filterOrigem !== "all" && cliente.origem !== filterOrigem) return false;
      if (filterPortal === "com" && !portalClienteIds.has(cliente.id)) return false;
      if (filterPortal === "sem" && portalClienteIds.has(cliente.id)) return false;
      if (filterTipo !== "all" && getTipoPessoa(cliente) !== filterTipo) return false;
      if (filterProjeto === "com" && !clienteIdsComProjeto.has(cliente.id)) return false;
      if (filterProjeto === "sem" && clienteIdsComProjeto.has(cliente.id)) return false;
      return true;
    });

    if (sortField) {
      const field = sortField;
      filtered.sort((a, b) => {
        const aValue = (a[field] ?? "").toString();
        const bValue = (b[field] ?? "").toString();
        const comparison = aValue.localeCompare(bValue, "pt-BR", { numeric: true, sensitivity: "base" });
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return filtered;
  }, [
    clientes,
    searchTerm,
    filterOrigem,
    filterPortal,
    filterTipo,
    filterProjeto,
    portalClienteIds,
    clienteIdsComProjeto,
    sortField,
    sortDirection,
  ]);

  const clearFilters = () => {
    setSearchTerm("");
    setFilterOrigem("all");
    setFilterPortal("all");
    setFilterTipo("all");
    setFilterProjeto("all");
  };

  return (
    <PageLayout
      className="overflow-y-hidden"
      containerClassName="h-full flex flex-col min-h-0"
      header={
        <PageHeader
          title="Clientes"
          description="Gerencie seus clientes"
          children={
            <Can feature="clientes" action="create">
              <Button
                className="rounded-full bg-brand hover:bg-brand/90 text-ink transition-colors px-5 py-2.5 text-sm"
                onClick={handleOpenCreate}
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo cliente
              </Button>
            </Can>
          }
        />
      }
    >
      <Card className="rounded-2xl border border-black/5 bg-white w-full flex flex-col flex-1 min-h-0 overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-lg font-medium tracking-tight">Lista de clientes</CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-1">
                Total de {filteredAndSortedClientes.length} de {clientes.length} cliente(s)
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Buscar por nome, CPF/CNPJ ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 pl-9 rounded-full text-sm"
                />
              </div>
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger className="h-9 w-full sm:w-32 rounded-full text-sm">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="PF">Pessoa física</SelectItem>
                  <SelectItem value="PJ">Pessoa jurídica</SelectItem>
                </SelectContent>
              </Select>
              {origens.length > 0 && (
                <Select value={filterOrigem} onValueChange={setFilterOrigem}>
                  <SelectTrigger className="h-9 w-full sm:w-36 rounded-full text-sm">
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
              <Select value={filterProjeto} onValueChange={setFilterProjeto}>
                <SelectTrigger className="h-9 w-full sm:w-36 rounded-full text-sm">
                  <SelectValue placeholder="Projeto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="com">Com projeto</SelectItem>
                  <SelectItem value="sem">Sem projeto</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPortal} onValueChange={setFilterPortal}>
                <SelectTrigger className="h-9 w-full sm:w-36 rounded-full text-sm">
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
          <div className="overflow-x-auto overflow-y-auto w-full h-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("nome")}
                      className="-ml-3 h-8 font-medium text-xs"
                    >
                      Nome
                      {renderSortIcon("nome")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("cpf_cnpj")}
                      className="-ml-3 h-8 font-medium text-xs"
                    >
                      CPF/CNPJ
                      {renderSortIcon("cpf_cnpj")}
                    </Button>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">Contato</TableHead>
                  {canShowActions && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      <TableCell>
                        <Skeleton className="h-4 w-40" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Skeleton className="h-4 w-48" />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      {canShowActions && (
                        <TableCell className="text-right">
                          <Skeleton className="ml-auto h-4 w-16" />
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={canShowActions ? 5 : 4}>
                      <EmptyState
                        icon={AlertCircle}
                        title="Erro ao carregar clientes"
                        description="Não foi possível carregar a lista. Verifique sua conexão e tente novamente."
                        action={{ label: "Tentar novamente", variant: "outline", onClick: () => refetch() }}
                      />
                    </TableCell>
                  </TableRow>
                ) : filteredAndSortedClientes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canShowActions ? 5 : 4}>
                      {clientes.length === 0 ? (
                        <EmptyState
                          icon={UsersRound}
                          title="Nenhum cliente cadastrado"
                          description="Crie o primeiro cliente para começar."
                          action={
                            can("clientes", "create")
                              ? { label: "Novo cliente", onClick: handleOpenCreate }
                              : undefined
                          }
                        />
                      ) : (
                        <EmptyState
                          icon={UsersRound}
                          title="Nenhum resultado encontrado"
                          description="Tente ajustar os filtros aplicados."
                          action={{ label: "Limpar filtros", variant: "outline", onClick: clearFilters }}
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
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {cliente.email}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{cliente.contato}</TableCell>
                      {canShowActions && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11"
                              disabled={!cliente.email}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedClienteForMessage(cliente);
                                setIsMessageModalOpen(true);
                              }}
                              aria-label="Enviar mensagem"
                              title={cliente.email ? "Enviar mensagem" : "Cliente sem e-mail cadastrado"}
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11"
                              onClick={(e) => handleEditClick(cliente, e)}
                              aria-label="Editar cliente"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Can feature="clientes" action="delete">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 text-red-500"
                                onClick={(e) => handleDeleteClick(cliente.id, e)}
                                aria-label="Excluir cliente"
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

      <ClienteFormDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} cliente={editingCliente} />

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
        description="O cliente sai da lista, mas o histórico é preservado. Você pode desfazer logo após excluir."
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </PageLayout>
  );
}

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { monitoring } from "@/lib/monitoring";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Mail,
  Trash2,
  Pencil,
  UsersRound,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatDocument, formatPhone } from "@/lib/maskUtils";
import { PilarPage } from "@/components/PilarPage";
import { usePermissions } from "@/hooks/usePermissions";
import { Can } from "@/components/Can";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  useClientes,
  useClientesPaginados,
  useOrigensClientes,
  type Cliente,
  type ClienteSortField,
  type FiltroTriplo,
} from "@/hooks/useClientes";
import { Skeleton } from "@/components/ui/skeleton";
import { ClienteMessageDialog } from "./ClienteMessageDialog";
import { ClienteFormDialog } from "./ClienteFormDialog";
import { EmptyState } from "@/components/EmptyState";
import { CLIENTES_PAGE_SIZE, getTotalPages, clampPage, getPageRange } from "./pagination";

export default function Clientes() {
  usePageTitle("Clientes");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { can } = usePermissions();
  const canShowActions = can("clientes", "edit");

  // Mutations e ações de portal. enableListQueries: false porque a lista agora
  // vem paginada do servidor; este hook aqui é só para deleteCliente.
  const { deleteCliente } = useClientes({ enableListQueries: false });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<{ id: string; nome: string } | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterOrigem, setFilterOrigem] = useState("all");
  const [filterPortal, setFilterPortal] = useState<FiltroTriplo>("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterProjeto, setFilterProjeto] = useState<FiltroTriplo>("all");

  const [sortField, setSortField] = useState<ClienteSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [page, setPage] = useState(0);

  // Message modal
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [selectedClienteForMessage, setSelectedClienteForMessage] = useState<Cliente | null>(null);
  const [messageText, setMessageText] = useState("");
  const [subjectText, setSubjectText] = useState("");

  // Debounce da busca para não disparar uma consulta por tecla.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Qualquer mudança de filtro/ordenação volta para a primeira página.
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, filterOrigem, filterPortal, filterTipo, filterProjeto, sortField, sortDirection]);

  const { clientes, total, isLoading, isFetching, isError, refetch } = useClientesPaginados({
    page,
    pageSize: CLIENTES_PAGE_SIZE,
    search: debouncedSearch,
    origem: filterOrigem,
    tipoPessoa: filterTipo,
    portal: filterPortal,
    projeto: filterProjeto,
    sortField: sortField ?? "nome",
    sortDir: sortField ? sortDirection : "asc",
  });

  const { data: origens = [] } = useOrigensClientes();

  const totalPages = getTotalPages(total, CLIENTES_PAGE_SIZE);
  const range = getPageRange(page, CLIENTES_PAGE_SIZE, total);

  const hasActiveFilters =
    debouncedSearch !== "" ||
    filterOrigem !== "all" ||
    filterPortal !== "all" ||
    filterTipo !== "all" ||
    filterProjeto !== "all";

  // Corrige a página se ela ficar fora do intervalo (ex.: excluir o último item
  // da última página). Só age quando não há carregamento em voo.
  useEffect(() => {
    if (isFetching) return;
    const clamped = clampPage(page, totalPages);
    if (clamped !== page) setPage(clamped);
  }, [page, totalPages, isFetching]);

  const handleOpenCreate = () => {
    setEditingCliente(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (cliente: Cliente, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingCliente(cliente);
    setIsDialogOpen(true);
  };

  // Deep-link ?edit=<id>: abre o formulário mesmo que o cliente não esteja na
  // página atual (busca o registro pontual quando necessário).
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId) return;

    const local = clientes.find((c) => c.id === editId);
    if (local) {
      setEditingCliente(local);
      setIsDialogOpen(true);
      setSearchParams({}, { replace: true });
      return;
    }

    let active = true;
    supabase
      .from("clientes")
      .select("*")
      .eq("id", editId)
      .is("deleted_at", null)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        setEditingCliente(data as unknown as Cliente);
        setIsDialogOpen(true);
        setSearchParams({}, { replace: true });
      });
    return () => {
      active = false;
    };
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
      toast.error("Não foi possível enviar a mensagem", { description: "Tente novamente em instantes." });
      resetMessageModal();
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

  const handleSort = (field: ClienteSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const renderSortIcon = (field: ClienteSortField) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-3 w-3 text-muted-foreground/50" />;
    return sortDirection === "asc" ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />;
  };

  const handleRowClick = (cliente: Cliente) => {
    navigate(`/gestao/clientes/${cliente.id}`);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterOrigem("all");
    setFilterPortal("all");
    setFilterTipo("all");
    setFilterProjeto("all");
  };

  return (
    <PilarPage
      className="overflow-y-hidden"
      containerClassName="h-full flex flex-col min-h-0"
      title="Clientes"
      search={{ value: searchTerm, onChange: setSearchTerm, placeholder: "Buscar por nome, CPF/CNPJ ou email" }}
      primaryAction={{ label: "Novo cliente", onClick: handleOpenCreate, icon: Plus, feature: "clientes", dataTour: "onb-novo-cliente" }}
    >
      <Card className="rounded-2xl border border-black/5 bg-white w-full flex flex-col flex-1 min-h-0 overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-lg font-medium tracking-tight">Lista de clientes</CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-1">
                {total > 0
                  ? `Mostrando ${range.from}-${range.to} de ${total} cliente(s)`
                  : "Nenhum cliente para exibir"}
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto">
              {/* Busca de texto migrou para o PageHeader (spec 002). */}
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
              <Select value={filterProjeto} onValueChange={(v) => setFilterProjeto(v as FiltroTriplo)}>
                <SelectTrigger className="h-9 w-full sm:w-36 rounded-full text-sm">
                  <SelectValue placeholder="Projeto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="com">Com projeto</SelectItem>
                  <SelectItem value="sem">Sem projeto</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPortal} onValueChange={(v) => setFilterPortal(v as FiltroTriplo)}>
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
        <CardContent className="flex-1 min-h-0 flex flex-col">
          <div className="overflow-x-auto overflow-y-auto w-full flex-1 min-h-0">
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
                ) : clientes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canShowActions ? 5 : 4}>
                      {hasActiveFilters ? (
                        <EmptyState
                          icon={UsersRound}
                          title="Nenhum resultado encontrado"
                          description="Tente ajustar os filtros aplicados."
                          action={{ label: "Limpar filtros", variant: "outline", onClick: clearFilters }}
                        />
                      ) : (
                        <EmptyState
                          icon={UsersRound}
                          title="Nenhum cliente cadastrado"
                          description="Crie o primeiro cliente para começar."
                          action={
                            can("clientes", "create") ? { label: "Novo cliente", onClick: handleOpenCreate } : undefined
                          }
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  clientes.map((cliente) => (
                    <TableRow
                      key={cliente.id}
                      className="cursor-pointer hover:bg-muted"
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
                      <TableCell className="hidden lg:table-cell">{formatPhone(cliente.contato)}</TableCell>
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
                                className="h-11 w-11 text-danger-mid"
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-4 border-t pt-4 mt-2">
              <p className="text-sm text-muted-foreground">
                Página {page + 1} de {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setPage((p) => Math.max(p - 1, 0))}
                  disabled={page === 0 || isFetching}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
                  disabled={page >= totalPages - 1 || isFetching}
                >
                  Próxima
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
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
        title="Excluir cliente"
        itemName={clienteToDelete?.nome}
        description="O cliente sai da lista, mas o histórico é preservado. Você pode desfazer logo após excluir."
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </PilarPage>
  );
}

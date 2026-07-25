import { useState, useMemo, useCallback, useEffect } from "react";
import { Plus, Pencil, Trash2, Loader2, Truck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Can } from "@/components/Can";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCNPJ, formatPhone, onlyDigits, validateEmail } from "@/lib/maskUtils";
import { isValidCNPJ } from "@/lib/brasilApi";

interface Fornecedor {
  id: string;
  nome: string;
  cnpj?: string;
  contato?: string;
  email?: string;
  telefone?: string;
}

type FormState = {
  nome: string;
  cnpj: string;
  contato: string;
  email: string;
  telefone: string;
};

const EMPTY_FORM: FormState = { nome: "", cnpj: "", contato: "", email: "", telefone: "" };

export default function Fornecedores() {
  usePageTitle("Fornecedores");
  const { can } = usePermissions();
  // Decisão de produto: fornecedores é intencionalmente gated pela feature "financeiro"
  // (contas a pagar/fornecedores fazem parte do módulo financeiro). Não há feature própria
  // "fornecedores" no controle de acesso — mudar isso exige alteração central de permissões.
  const canEdit = can("financeiro", "edit");

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [cnpjError, setCnpjError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; nome: string } | null>(null);

  const fetchFornecedores = useCallback(async () => {
    const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
    if (error) {
      setLoadError(true);
      toast.error("Erro ao carregar fornecedores");
      return;
    }
    setLoadError(false);
    setFornecedores(
      (data ?? []).map((f) => ({
        id: f.id,
        nome: f.nome,
        cnpj: f.cnpj ?? undefined,
        contato: f.contato ?? undefined,
        email: f.email ?? undefined,
        telefone: f.telefone ?? undefined,
      }))
    );
  }, []);

  useEffect(() => {
    fetchFornecedores();
  }, [fetchFornecedores]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setCurrentId(null);
    setIsEditMode(false);
    setCnpjError("");
    setEmailError("");
  };

  const handleOpenNew = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEditClick = (f: Fornecedor, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setForm({
      nome: f.nome,
      cnpj: f.cnpj ? formatCNPJ(f.cnpj) : "",
      contato: f.contato ?? "",
      email: f.email ?? "",
      telefone: f.telefone ? formatPhone(f.telefone) : "",
    });
    setCnpjError("");
    setEmailError("");
    setCurrentId(f.id);
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const handleCnpjChange = (value: string) => {
    const formatted = formatCNPJ(value);
    setForm((prev) => ({ ...prev, cnpj: formatted }));
    if (cnpjError) setCnpjError("");
  };

  const handleTelefoneChange = (value: string) => {
    const formatted = formatPhone(value);
    setForm((prev) => ({ ...prev, telefone: formatted }));
  };

  const validateForm = (): boolean => {
    if (!form.nome.trim()) {
      toast.error("O nome do fornecedor é obrigatório");
      return false;
    }
    let valid = true;
    const cnpjDigits = onlyDigits(form.cnpj);
    if (cnpjDigits.length > 0 && !isValidCNPJ(form.cnpj)) {
      setCnpjError("CNPJ inválido");
      valid = false;
    } else {
      setCnpjError("");
    }
    if (form.email.trim() && !validateEmail(form.email.trim())) {
      setEmailError("E-mail inválido");
      valid = false;
    } else {
      setEmailError("");
    }
    return valid;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const cnpjRaw = onlyDigits(form.cnpj) || null;
      const telefoneRaw = onlyDigits(form.telefone) || null;

      if (isEditMode && currentId) {
        const { error } = await supabase
          .from("fornecedores")
          .update({
            nome: form.nome.trim(),
            cnpj: cnpjRaw,
            contato: form.contato.trim() || null,
            email: form.email.trim() || null,
            telefone: telefoneRaw,
          })
          .eq("id", currentId);
        if (error) throw error;
        toast.success("Fornecedor atualizado");
      } else {
        const { error } = await supabase.from("fornecedores").insert({
          nome: form.nome.trim(),
          cnpj: cnpjRaw,
          contato: form.contato.trim() || null,
          email: form.email.trim() || null,
          telefone: telefoneRaw,
          empresa_id: (await supabase.rpc("get_user_empresa_id")).data,
        } as never);
        if (error) throw error;
        toast.success("Fornecedor adicionado");
      }
      resetForm();
      setIsDialogOpen(false);
      fetchFornecedores();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("unique") || message.includes("duplicate") || message.includes("fornecedores_cnpj")) {
        toast.error("CNPJ já cadastrado para outro fornecedor");
      } else {
        toast.error("Erro ao salvar fornecedor");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (f: Fornecedor, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setToDelete({ id: f.id, nome: f.nome });
    setConfirmDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!toDelete) return;
    const id = toDelete.id;
    // Soft delete (a RLS já esconde deleted_at da lista), com "Desfazer" no toast
    // como cliente/lead — o delete é recuperável (ACH-FOR-01).
    const { error } = await supabase.from("fornecedores").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      toast.error("Erro ao excluir fornecedor");
      return;
    }
    toast.success("Fornecedor excluído", {
      action: {
        label: "Desfazer",
        onClick: async () => {
          const { error: restoreError } = await supabase.from("fornecedores").update({ deleted_at: null }).eq("id", id);
          if (restoreError) toast.error("Erro ao restaurar fornecedor");
          else {
            toast.success("Fornecedor restaurado");
            fetchFornecedores();
          }
        },
      },
    });
    setConfirmDeleteOpen(false);
    setToDelete(null);
    fetchFornecedores();
  };

  // BUG-A7-2: filter by nome, CNPJ (digits or formatted) and email
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return fornecedores;
    const termDigits = onlyDigits(term);
    return fornecedores.filter((f) => {
      if (f.nome.toLowerCase().includes(term)) return true;
      const cnpjDigits = onlyDigits(f.cnpj ?? "");
      if (cnpjDigits && termDigits && cnpjDigits.includes(termDigits)) return true;
      if (formatCNPJ(cnpjDigits).includes(term)) return true;
      if ((f.email ?? "").toLowerCase().includes(term)) return true;
      return false;
    });
  }, [fornecedores, searchTerm]);

  return (
    <PageLayout
      className="overflow-y-hidden"
      containerClassName="h-full flex flex-col min-h-0"
      header={
        <PageHeader
          title="Fornecedores"
          search={{ value: searchTerm, onChange: setSearchTerm, placeholder: "Buscar fornecedores" }}
          primaryAction={{ label: "Novo fornecedor", onClick: handleOpenNew, icon: Plus, feature: "financeiro" }}
          children={
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{isEditMode ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
                  <DialogDescription>
                    {isEditMode ? "Atualize os dados do fornecedor" : "Cadastre um novo fornecedor"}
                  </DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSave();
                  }}
                  className="space-y-3 pt-2"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="nome" className="text-xs">
                      Nome / Razão Social *
                    </Label>
                    <Input
                      id="nome"
                      value={form.nome}
                      onChange={(e) => setForm({ ...form, nome: e.target.value })}
                      placeholder="Razão social ou nome fantasia"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cnpj" className="text-xs">
                      CNPJ
                    </Label>
                    <Input
                      id="cnpj"
                      value={form.cnpj}
                      onChange={(e) => handleCnpjChange(e.target.value)}
                      placeholder="00.000.000/0000-00"
                      aria-invalid={!!cnpjError}
                      aria-describedby={cnpjError ? "fornecedor-cnpj-error" : undefined}
                      className={cnpjError ? "border-red-500 focus-visible:ring-red-500" : ""}
                    />
                    {cnpjError && (
                      <p id="fornecedor-cnpj-error" role="alert" className="text-xs text-red-600">
                        {cnpjError}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="contato" className="text-xs">
                        Contato
                      </Label>
                      <Input
                        id="contato"
                        value={form.contato}
                        onChange={(e) => setForm({ ...form, contato: e.target.value })}
                        placeholder="Nome do contato"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="telefone" className="text-xs">
                        Telefone
                      </Label>
                      <Input
                        id="telefone"
                        value={form.telefone}
                        onChange={(e) => handleTelefoneChange(e.target.value)}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => {
                        setForm({ ...form, email: e.target.value });
                        if (emailError) setEmailError("");
                      }}
                      placeholder="email@exemplo.com"
                      aria-invalid={!!emailError}
                      aria-describedby={emailError ? "fornecedor-email-error" : undefined}
                      className={emailError ? "border-red-500 focus-visible:ring-red-500" : ""}
                    />
                    {emailError && (
                      <p id="fornecedor-email-error" role="alert" className="text-xs text-red-600">
                        {emailError}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                      Cancelar
                    </Button>
                    <div className="flex-1" />
                    <Button type="submit" className="bg-brand hover:bg-brand/90 text-ink" disabled={isSaving}>
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
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
      <Card className="rounded-2xl border border-black/5 bg-white w-full flex flex-col flex-1 min-h-0 overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-lg font-medium tracking-tight">Lista de Fornecedores</CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-1">
                Total de {filtered.length} de {fornecedores.length} fornecedor(es)
              </CardDescription>
            </div>
            {/* Busca de texto migrou para o PageHeader (spec 002). */}
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0">
          <div className="overflow-x-auto overflow-y-auto w-full h-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead className="hidden md:table-cell">Contato</TableHead>
                  <TableHead className="hidden lg:table-cell">Telefone</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  {canEdit && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 6 : 5}>
                      {loadError ? (
                        <EmptyState
                          icon={Truck}
                          title="Não foi possível carregar os fornecedores"
                          description="Atualize a página em instantes."
                          action={{ label: "Tentar de novo", variant: "outline", onClick: () => fetchFornecedores() }}
                        />
                      ) : fornecedores.length === 0 ? (
                        <EmptyState
                          icon={Truck}
                          title="Nenhum fornecedor cadastrado"
                          description="Crie o primeiro fornecedor para começar."
                          action={
                            can("financeiro", "create")
                              ? { label: "Novo Fornecedor", onClick: handleOpenNew }
                              : undefined
                          }
                        />
                      ) : (
                        <EmptyState
                          icon={Truck}
                          title="Nenhum resultado encontrado"
                          description="Tente ajustar o termo de busca."
                          action={{ label: "Limpar busca", variant: "outline", onClick: () => setSearchTerm("") }}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.nome}</TableCell>
                      <TableCell>{f.cnpj ? formatCNPJ(f.cnpj) : "-"}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {f.contato || "-"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {f.telefone ? formatPhone(f.telefone) : "-"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {f.email || "-"}
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              onClick={(e) => handleEditClick(f, e)}
                              aria-label="Editar fornecedor"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Can feature="financeiro" action="delete">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-red-500"
                                onClick={(e) => handleDeleteClick(f, e)}
                                aria-label="Excluir fornecedor"
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

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        onConfirm={handleDeleteConfirm}
        title="Excluir Fornecedor"
        itemName={toDelete?.nome}
        description="O fornecedor sai das listagens e o histórico de despesas é preservado."
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </PageLayout>
  );
}

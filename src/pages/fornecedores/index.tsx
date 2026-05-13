import { useState, useMemo, useCallback, useEffect } from "react";
import { Plus, Search, Pencil, Trash2, Loader2, Truck } from "lucide-react";
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
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Can } from "@/components/Can";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Fornecedor {
  id: string;
  nome: string;
  cnpj?: string;
  contato?: string;
  email?: string;
}

const EMPTY_FORM = { nome: "", cnpj: "", contato: "", email: "" };

export default function Fornecedores() {
  usePageTitle("Fornecedores");
  const { can } = usePermissions();
  const canEdit = can("financeiro", "edit");

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; nome: string } | null>(null);

  const fetchFornecedores = useCallback(async () => {
    const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
    if (error) { toast.error("Erro ao carregar fornecedores"); return; }
    setFornecedores(
      (data ?? []).map((f) => ({
        id: f.id,
        nome: f.nome,
        cnpj: f.cnpj ?? undefined,
        contato: f.contato ?? undefined,
        email: f.email ?? undefined,
      }))
    );
  }, []);

  useEffect(() => { fetchFornecedores(); }, [fetchFornecedores]);

  const resetForm = () => { setForm(EMPTY_FORM); setCurrentId(null); setIsEditMode(false); };

  const handleOpenNew = () => { resetForm(); setIsDialogOpen(true); };

  const handleEditClick = (f: Fornecedor, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setForm({ nome: f.nome, cnpj: f.cnpj ?? "", contato: f.contato ?? "", email: f.email ?? "" });
    setCurrentId(f.id);
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast.error("O nome do fornecedor é obrigatório");
      return;
    }
    setIsSaving(true);
    try {
      if (isEditMode && currentId) {
        const { error } = await supabase
          .from("fornecedores")
          .update({ nome: form.nome.trim(), cnpj: form.cnpj.trim() || null, contato: form.contato.trim() || null, email: form.email.trim() || null })
          .eq("id", currentId);
        if (error) throw error;
        toast.success("Fornecedor atualizado");
      } else {
        const { error } = await supabase.from("fornecedores").insert({
          nome: form.nome.trim(),
          cnpj: form.cnpj.trim() || null,
          contato: form.contato.trim() || null,
          email: form.email.trim() || null,
          empresa_id: (await supabase.rpc("get_user_empresa_id")).data,
        } as never);
        if (error) throw error;
        toast.success("Fornecedor adicionado");
      }
      resetForm();
      setIsDialogOpen(false);
      fetchFornecedores();
    } catch {
      toast.error("Erro ao salvar fornecedor");
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
    const { error } = await supabase.from("fornecedores").delete().eq("id", toDelete.id);
    if (error) { toast.error("Erro ao excluir fornecedor"); return; }
    toast.success("Fornecedor excluído");
    setConfirmDeleteOpen(false);
    setToDelete(null);
    fetchFornecedores();
  };

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return fornecedores;
    return fornecedores.filter(
      (f) =>
        f.nome.toLowerCase().includes(term) ||
        (f.cnpj ?? "").replace(/\D/g, "").includes(term.replace(/\D/g, "")) ||
        (f.email ?? "").toLowerCase().includes(term)
    );
  }, [fornecedores, searchTerm]);

  return (
    <PageLayout
      className="overflow-y-hidden"
      containerClassName="h-full flex flex-col min-h-0"
      header={
        <PageHeader
          title="Fornecedores"
          description="Gerencie os fornecedores da empresa"
          children={
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
              <Can feature="financeiro" action="create">
                <DialogTrigger asChild>
                  <Button
                    className="rounded-full bg-brand hover:bg-brand/90 text-ink transition-colors px-5 py-2.5 text-sm"
                    onClick={handleOpenNew}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Fornecedor
                  </Button>
                </DialogTrigger>
              </Can>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{isEditMode ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
                  <DialogDescription>
                    {isEditMode ? "Atualize os dados do fornecedor" : "Cadastre um novo fornecedor"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="nome" className="text-xs">Nome / Razão Social *</Label>
                    <Input
                      id="nome"
                      value={form.nome}
                      onChange={(e) => setForm({ ...form, nome: e.target.value })}
                      placeholder="Razão social ou nome fantasia"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cnpj" className="text-xs">CNPJ</Label>
                    <Input
                      id="cnpj"
                      value={form.cnpj}
                      onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="contato" className="text-xs">Contato</Label>
                      <Input
                        id="contato"
                        value={form.contato}
                        onChange={(e) => setForm({ ...form, contato: e.target.value })}
                        placeholder="Nome do contato"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                      Cancelar
                    </Button>
                    <div className="flex-1" />
                    <Button type="submit" className="bg-brand hover:bg-brand/90 text-ink" disabled={isSaving}>
                      {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : isEditMode ? "Atualizar" : "Salvar"}
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
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar por nome ou CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 pl-9 rounded-full text-sm"
              />
            </div>
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
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  {canEdit && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 5 : 4}>
                      {fornecedores.length === 0 ? (
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
                      <TableCell>{f.cnpj || "-"}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{f.contato || "-"}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{f.email || "-"}</TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => handleEditClick(f, e)}
                              aria-label="Editar fornecedor"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Can feature="financeiro" action="delete">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500"
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
        description="Esta ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </PageLayout>
  );
}

import { useState, useEffect, useCallback } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Supplier {
  id: string;
  name: string; // 'nome' in DB
  contact?: string; // 'contato' in DB
  email?: string;
  phone?: string; // not in DB explicitly, but 'contato' might cover it, or I should add it. DB has 'contato' and 'email'. 'telefone' is not in fornecedores table in Schema!
  // Schema: nome, cnpj, contato, email. No 'phone' column.
  // I will map 'phone' to 'contato' or assume 'contato' is generic.
  // Wait, schema says: contato TEXT.
  // I will use 'contact' for 'contato' and 'email' for 'email'.
  // I'll add 'cnpj' since it is in schema.
  cnpj?: string;
}

interface SupplierManagerProps {
  onSupplierChange?: (suppliers: Supplier[]) => void;
}

export function SupplierManager({ onSupplierChange }: SupplierManagerProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newSupplier, setNewSupplier] = useState<Omit<Supplier, "id">>({
    name: "",
    contact: "",
    email: "",
    cnpj: "",
  });
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [deleteSupplier, setDeleteSupplier] = useState<Supplier | null>(null);

  const fetchSuppliers = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("fornecedores").select("*").order("nome");

      if (error) throw error;

      const mappedSuppliers = (data || []).map((sup) => ({
        id: sup.id,
        name: sup.nome,
        contact: sup.contato ?? undefined,
        email: sup.email ?? undefined,
        cnpj: sup.cnpj ?? undefined,
      }));

      setSuppliers(mappedSuppliers);
      if (onSupplierChange) {
        onSupplierChange(mappedSuppliers);
      }
    } catch (err: unknown) {
      toast.error("Erro ao carregar fornecedores");
    }
  }, [onSupplierChange, toast]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleAddSupplier = async () => {
    if (!newSupplier.name.trim()) {
      toast.error("Campo obrigatório", { description: "O nome do fornecedor é obrigatório" });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from("fornecedores").insert({
        nome: newSupplier.name.trim(),
        contato: newSupplier.contact?.trim(),
        email: newSupplier.email?.trim(),
        cnpj: newSupplier.cnpj?.trim(),
        empresa_id: (await supabase.rpc("get_user_empresa_id")).data,
      } as never);

      if (error) throw error;

      toast.success("Fornecedor adicionado", { description: "O fornecedor foi adicionado com sucesso" });

      setNewSupplier({ name: "", contact: "", email: "", cnpj: "" });
      setIsAddDialogOpen(false);
      fetchSuppliers();
    } catch (err: unknown) {
      toast.error("Erro ao adicionar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSupplier = async () => {
    if (!editSupplier || !editSupplier.name.trim()) {
      toast.error("Campo obrigatório", { description: "O nome do fornecedor é obrigatório" });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("fornecedores")
        .update({
          nome: editSupplier.name.trim(),
          contato: editSupplier.contact?.trim(),
          email: editSupplier.email?.trim(),
          cnpj: editSupplier.cnpj?.trim(),
        })
        .eq("id", editSupplier.id);

      if (error) throw error;

      toast.success("Fornecedor atualizado", { description: "O fornecedor foi atualizado com sucesso" });

      setEditSupplier(null);
      setIsEditDialogOpen(false);
      fetchSuppliers();
    } catch (err: unknown) {
      toast.error("Erro ao atualizar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!deleteSupplier) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase.from("fornecedores").delete().eq("id", deleteSupplier.id);

      if (error) throw error;

      toast.success("Fornecedor removido", { description: "O fornecedor foi removido com sucesso" });

      setDeleteSupplier(null);
      setIsDeleteDialogOpen(false);
      fetchSuppliers();
    } catch (err: unknown) {
      toast.error("Erro ao remover");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Fornecedores</h2>
          <p className="text-sm text-muted-foreground">Gerencie os fornecedores da empresa</p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="brand">
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Novo Fornecedor</DialogTitle>
              <DialogDescription>Adicione um novo fornecedor ao sistema</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="supplierName" className="text-xs">
                  Nome *
                </Label>
                <Input
                  id="supplierName"
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  placeholder="Razão social ou nome fantasia"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplierCnpj" className="text-xs">
                  CNPJ
                </Label>
                <Input
                  id="supplierCnpj"
                  value={newSupplier.cnpj || ""}
                  onChange={(e) => setNewSupplier({ ...newSupplier, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="supplierContact" className="text-xs">
                    Contato
                  </Label>
                  <Input
                    id="supplierContact"
                    value={newSupplier.contact || ""}
                    onChange={(e) => setNewSupplier({ ...newSupplier, contact: e.target.value })}
                    placeholder="Nome do contato"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplierEmail" className="text-xs">
                    Email
                  </Label>
                  <Input
                    id="supplierEmail"
                    type="email"
                    value={newSupplier.email || ""}
                    onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                  className="flex-1"
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button onClick={handleAddSupplier} variant="brand" className="flex-1" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                    </>
                  ) : (
                    "Adicionar"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>CNPJ</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="w-24 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                Nenhum fornecedor cadastrado
              </TableCell>
            </TableRow>
          ) : (
            suppliers.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell className="font-medium">{supplier.name}</TableCell>
                <TableCell>{supplier.cnpj || "-"}</TableCell>
                <TableCell>{supplier.contact || "-"}</TableCell>
                <TableCell>{supplier.email || "-"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditSupplier(supplier);
                      setIsEditDialogOpen(true);
                    }}
                    aria-label="Editar fornecedor"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setDeleteSupplier(supplier);
                      setIsDeleteDialogOpen(true);
                    }}
                    aria-label="Excluir fornecedor"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Fornecedor</DialogTitle>
            <DialogDescription>Altere as informações do fornecedor</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="editSupplierName" className="text-xs">
                Nome *
              </Label>
              <Input
                id="editSupplierName"
                value={editSupplier?.name || ""}
                onChange={(e) => setEditSupplier(editSupplier ? { ...editSupplier, name: e.target.value } : null)}
                placeholder="Razão social ou nome fantasia"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editSupplierCnpj" className="text-xs">
                CNPJ
              </Label>
              <Input
                id="editSupplierCnpj"
                value={editSupplier?.cnpj || ""}
                onChange={(e) => setEditSupplier(editSupplier ? { ...editSupplier, cnpj: e.target.value } : null)}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="editSupplierContact" className="text-xs">
                  Contato
                </Label>
                <Input
                  id="editSupplierContact"
                  value={editSupplier?.contact || ""}
                  onChange={(e) => setEditSupplier(editSupplier ? { ...editSupplier, contact: e.target.value } : null)}
                  placeholder="Nome do contato"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editSupplierEmail" className="text-xs">
                  Email
                </Label>
                <Input
                  id="editSupplierEmail"
                  type="email"
                  value={editSupplier?.email || ""}
                  onChange={(e) => setEditSupplier(editSupplier ? { ...editSupplier, email: e.target.value } : null)}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                className="flex-1"
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button onClick={handleEditSupplier} variant="brand" className="flex-1" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteSupplier}
        title="Excluir fornecedor?"
        itemName={deleteSupplier?.name}
        description="Esta ação não pode ser desfeita."
        confirmText="Excluir"
        loading={isDeleting}
      />
    </div>
  );
}

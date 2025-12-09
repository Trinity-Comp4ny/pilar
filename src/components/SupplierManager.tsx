import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
  const [newSupplier, setNewSupplier] = useState<Omit<Supplier, "id">>({
    name: "",
    contact: "",
    email: "",
    cnpj: "",
  });
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [deleteSupplier, setDeleteSupplier] = useState<Supplier | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await (supabase
        .from('fornecedores') as any)
        .select('*')
        .order('nome');

      if (error) throw error;

      const mappedSuppliers = (data || []).map(sup => ({
        id: sup.id,
        name: sup.nome,
        contact: sup.contato,
        email: sup.email,
        cnpj: sup.cnpj
      }));

      setSuppliers(mappedSuppliers);
      if (onSupplierChange) {
        onSupplierChange(mappedSuppliers);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar fornecedores",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddSupplier = async () => {
    if (!newSupplier.name.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O nome do fornecedor é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
       const { error } = await (supabase
        .from('fornecedores') as any)
        .insert({
          nome: newSupplier.name.trim(),
          contato: newSupplier.contact?.trim(),
          email: newSupplier.email?.trim(),
          cnpj: newSupplier.cnpj?.trim(),
          empresa_id: (await (supabase.rpc as any)('get_user_empresa_id')).data 
        });

      if (error) throw error;

      toast({
        title: "Fornecedor adicionado",
        description: "O fornecedor foi adicionado com sucesso",
      });

      setNewSupplier({
        name: "",
        contact: "",
        email: "",
        cnpj: "",
      });
      setIsAddDialogOpen(false);
      fetchSuppliers();
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditSupplier = async () => {
    if (!editSupplier || !editSupplier.name.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O nome do fornecedor é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await (supabase
        .from('fornecedores') as any)
        .update({
          nome: editSupplier.name.trim(),
          contato: editSupplier.contact?.trim(),
          email: editSupplier.email?.trim(),
          cnpj: editSupplier.cnpj?.trim()
        })
        .eq('id', editSupplier.id);

      if (error) throw error;

      toast({
        title: "Fornecedor atualizado",
        description: "O fornecedor foi atualizado com sucesso",
      });

      setEditSupplier(null);
      setIsEditDialogOpen(false);
      fetchSuppliers();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteSupplier = async () => {
    if (!deleteSupplier) return;

    try {
      const { error } = await (supabase
        .from('fornecedores') as any)
        .delete()
        .eq('id', deleteSupplier.id);

      if (error) throw error;

      toast({
        title: "Fornecedor removido",
        description: "O fornecedor foi removido com sucesso",
      });

      setDeleteSupplier(null);
      setIsDeleteDialogOpen(false);
      fetchSuppliers();
    } catch (error: any) {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      });
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
            <Button size="sm" className="vrz-button-primary">
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Novo Fornecedor</DialogTitle>
              <DialogDescription>
                Adicione um novo fornecedor ao sistema
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="supplierName">Nome do Fornecedor *</Label>
                <Input
                  id="supplierName"
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({...newSupplier, name: e.target.value})}
                  placeholder="Digite o nome do fornecedor"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="supplierCnpj">CNPJ</Label>
                 <Input
                  id="supplierCnpj"
                  value={newSupplier.cnpj || ""}
                  onChange={(e) => setNewSupplier({...newSupplier, cnpj: e.target.value})}
                  placeholder="00.000.000/0000-00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplierContact">Pessoa de Contato</Label>
                <Input
                  id="supplierContact"
                  value={newSupplier.contact || ""}
                  onChange={(e) => setNewSupplier({...newSupplier, contact: e.target.value})}
                  placeholder="Nome do contato"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="supplierEmail">Email</Label>
                <Input
                  id="supplierEmail"
                  type="email"
                  value={newSupplier.email || ""}
                  onChange={(e) => setNewSupplier({...newSupplier, email: e.target.value})}
                  placeholder="email@exemplo.com"
                />
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={handleAddSupplier} className="flex-1 vrz-button-primary">
                  Adicionar
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
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      
      {/* Dialog para editar fornecedor */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Fornecedor</DialogTitle>
            <DialogDescription>
              Altere as informações do fornecedor
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="editSupplierName">Nome do Fornecedor *</Label>
              <Input
                id="editSupplierName"
                value={editSupplier?.name || ""}
                onChange={(e) => setEditSupplier(editSupplier ? { ...editSupplier, name: e.target.value } : null)}
                placeholder="Digite o nome do fornecedor"
              />
            </div>
            
            <div className="space-y-2">
                <Label htmlFor="editSupplierCnpj">CNPJ</Label>
                 <Input
                  id="editSupplierCnpj"
                  value={editSupplier?.cnpj || ""}
                  onChange={(e) => setEditSupplier(editSupplier ? { ...editSupplier, cnpj: e.target.value } : null)}
                  placeholder="00.000.000/0000-00"
                />
              </div>

            <div className="space-y-2">
              <Label htmlFor="editSupplierContact">Pessoa de Contato</Label>
              <Input
                id="editSupplierContact"
                value={editSupplier?.contact || ""}
                onChange={(e) => setEditSupplier(editSupplier ? { ...editSupplier, contact: e.target.value } : null)}
                placeholder="Nome do contato"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="editSupplierEmail">Email</Label>
              <Input
                id="editSupplierEmail"
                type="email"
                value={editSupplier?.email || ""}
                onChange={(e) => setEditSupplier(editSupplier ? { ...editSupplier, email: e.target.value } : null)}
                placeholder="email@exemplo.com"
              />
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleEditSupplier} className="flex-1 vrz-button-primary">
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Dialog para confirmar exclusão */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o fornecedor "{deleteSupplier?.name}"?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteSupplier} className="flex-1">
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

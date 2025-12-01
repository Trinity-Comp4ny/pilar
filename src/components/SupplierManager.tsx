import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Supplier {
  id: string;
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
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
    phone: "",
  });
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [deleteSupplier, setDeleteSupplier] = useState<Supplier | null>(null);
  const { toast } = useToast();

  const STORAGE_KEY = "vrz-financeiro-suppliers";

  // Carregar fornecedores do localStorage na inicialização
  useEffect(() => {
    const savedSuppliers = localStorage.getItem(STORAGE_KEY);
    if (savedSuppliers) {
      setSuppliers(JSON.parse(savedSuppliers));
    }
  }, []);

  // Salvar fornecedores no localStorage quando houver mudanças
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(suppliers));
    if (onSupplierChange) {
      onSupplierChange(suppliers);
    }
  }, [suppliers, onSupplierChange]);

  const handleAddSupplier = () => {
    if (!newSupplier.name.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O nome do fornecedor é obrigatório",
        variant: "destructive",
      });
      return;
    }

    const supplier: Supplier = {
      id: Date.now().toString(),
      name: newSupplier.name.trim(),
      contact: newSupplier.contact?.trim(),
      email: newSupplier.email?.trim(),
      phone: newSupplier.phone?.trim(),
    };

    setSuppliers([...suppliers, supplier]);
    setNewSupplier({
      name: "",
      contact: "",
      email: "",
      phone: "",
    });
    setIsAddDialogOpen(false);

    toast({
      title: "Fornecedor adicionado",
      description: "O fornecedor foi adicionado com sucesso",
    });
  };

  const handleEditSupplier = () => {
    if (!editSupplier || !editSupplier.name.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O nome do fornecedor é obrigatório",
        variant: "destructive",
      });
      return;
    }

    setSuppliers(suppliers.map(sup => 
      sup.id === editSupplier.id ? { ...editSupplier, name: editSupplier.name.trim() } : sup
    ));
    setEditSupplier(null);
    setIsEditDialogOpen(false);

    toast({
      title: "Fornecedor atualizado",
      description: "O fornecedor foi atualizado com sucesso",
    });
  };

  const handleDeleteSupplier = () => {
    if (!deleteSupplier) return;

    setSuppliers(suppliers.filter(sup => sup.id !== deleteSupplier.id));
    setDeleteSupplier(null);
    setIsDeleteDialogOpen(false);

    toast({
      title: "Fornecedor removido",
      description: "O fornecedor foi removido com sucesso",
    });
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
              
              <div className="space-y-2">
                <Label htmlFor="supplierPhone">Telefone</Label>
                <Input
                  id="supplierPhone"
                  value={newSupplier.phone || ""}
                  onChange={(e) => setNewSupplier({...newSupplier, phone: e.target.value})}
                  placeholder="(00) 00000-0000"
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
            <TableHead>Contato</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Telefone</TableHead>
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
                <TableCell>{supplier.contact || "-"}</TableCell>
                <TableCell>{supplier.email || "-"}</TableCell>
                <TableCell>{supplier.phone || "-"}</TableCell>
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
            
            <div className="space-y-2">
              <Label htmlFor="editSupplierPhone">Telefone</Label>
              <Input
                id="editSupplierPhone"
                value={editSupplier?.phone || ""}
                onChange={(e) => setEditSupplier(editSupplier ? { ...editSupplier, phone: e.target.value } : null)}
                placeholder="(00) 00000-0000"
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

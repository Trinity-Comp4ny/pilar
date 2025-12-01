import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Category {
  id: string;
  name: string;
}

interface CategoryManagerProps {
  title: string;
  description: string;
  storageKey: string;
  onCategoryChange?: (categories: Category[]) => void;
}

export function CategoryManager({ title, description, storageKey, onCategoryChange }: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);
  const { toast } = useToast();

  // Carregar categorias do localStorage na inicialização
  useEffect(() => {
    const savedCategories = localStorage.getItem(storageKey);
    if (savedCategories) {
      setCategories(JSON.parse(savedCategories));
    }
  }, [storageKey]);

  // Salvar categorias no localStorage quando houver mudanças
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(categories));
    if (onCategoryChange) {
      onCategoryChange(categories);
    }
  }, [categories, storageKey, onCategoryChange]);

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O nome da categoria é obrigatório",
        variant: "destructive",
      });
      return;
    }

    const newCategory: Category = {
      id: Date.now().toString(),
      name: newCategoryName.trim(),
    };

    setCategories([...categories, newCategory]);
    setNewCategoryName("");
    setIsAddDialogOpen(false);

    toast({
      title: "Categoria adicionada",
      description: "A categoria foi adicionada com sucesso",
    });
  };

  const handleEditCategory = () => {
    if (!editCategory || !editCategory.name.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O nome da categoria é obrigatório",
        variant: "destructive",
      });
      return;
    }

    setCategories(categories.map(cat => 
      cat.id === editCategory.id ? { ...cat, name: editCategory.name.trim() } : cat
    ));
    setEditCategory(null);
    setIsEditDialogOpen(false);

    toast({
      title: "Categoria atualizada",
      description: "A categoria foi atualizada com sucesso",
    });
  };

  const handleDeleteCategory = () => {
    if (!deleteCategory) return;

    setCategories(categories.filter(cat => cat.id !== deleteCategory.id));
    setDeleteCategory(null);
    setIsDeleteDialogOpen(false);

    toast({
      title: "Categoria removida",
      description: "A categoria foi removida com sucesso",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="pilar-button-primary">
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Nova Categoria</DialogTitle>
              <DialogDescription>
                Adicione uma nova categoria ao sistema
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="categoryName">Nome da Categoria</Label>
                <Input
                  id="categoryName"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Digite o nome da categoria"
                />
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={handleAddCategory} className="flex-1 pilar-button-primary">
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
            <TableHead className="w-24 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-muted-foreground py-6">
                Nenhuma categoria cadastrada
              </TableCell>
            </TableRow>
          ) : (
            categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell>{category.name}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditCategory(category);
                      setIsEditDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setDeleteCategory(category);
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
      
      {/* Dialog para editar categoria */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Categoria</DialogTitle>
            <DialogDescription>
              Altere o nome da categoria
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="editCategoryName">Nome da Categoria</Label>
              <Input
                id="editCategoryName"
                value={editCategory?.name || ""}
                onChange={(e) => setEditCategory(editCategory ? { ...editCategory, name: e.target.value } : null)}
                placeholder="Digite o nome da categoria"
              />
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleEditCategory} className="flex-1 pilar-button-primary">
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
              Tem certeza que deseja excluir a categoria "{deleteCategory?.name}"?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteCategory} className="flex-1">
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

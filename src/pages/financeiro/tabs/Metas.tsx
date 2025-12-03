import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Plus, Target, TrendingUp, Wallet, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";

interface Meta {
  id: string;
  nome: string;
  alvo: number;
  atual: number;
  prazo: string;
  categoria: "receita" | "lucro" | "economia" | "investimento";
}

export default function Metas() {
  const { toast } = useToast();
  const [metas, setMetas] = useState<Meta[]>([
    {
      id: "1",
      nome: "Faturamento Anual",
      alvo: 1500000,
      atual: 1500000,
      prazo: "2024-12-31",
      categoria: "receita"
    },
    {
      id: "2",
      nome: "Margem de Lucro Líquido",
      alvo: 500000,
      atual: 380000,
      prazo: "2024-12-31",
      categoria: "lucro"
    },
    {
      id: "3",
      nome: "Fundo de Reserva",
      alvo: 100000,
      atual: 45000,
      prazo: "2024-12-31",
      categoria: "investimento"
    },
    {
      id: "4",
      nome: "Redução de Custos Operacionais",
      alvo: 50000,
      atual: 15000,
      prazo: "2024-06-30",
      categoria: "economia"
    }
  ]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [metaToDelete, setMetaToDelete] = useState<string | null>(null);
  const [editingMeta, setEditingMeta] = useState<Meta | null>(null);
  
  const [novaMeta, setNovaMeta] = useState({
    nome: "",
    alvo: "",
    atual: "",
    prazo: "",
    categoria: "receita"
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const meta: Meta = {
      id: Date.now().toString(),
      nome: novaMeta.nome,
      alvo: Number(novaMeta.alvo),
      atual: Number(novaMeta.atual),
      prazo: novaMeta.prazo,
      categoria: novaMeta.categoria as any
    };
    
    setMetas([...metas, meta]);
    setIsDialogOpen(false);
    setNovaMeta({ nome: "", alvo: "", atual: "", prazo: "", categoria: "receita" });
    
    toast({
      title: "Meta criada",
      description: "Nova meta financeira estabelecida com sucesso."
    });
  };

  const handleEdit = (meta: Meta) => {
    setEditingMeta(meta);
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMeta) return;
    
    setMetas(metas.map(m => m.id === editingMeta.id ? editingMeta : m));
    setIsEditDialogOpen(false);
    setEditingMeta(null);
    
    toast({
      title: "Meta atualizada",
      description: "Meta financeira foi atualizada com sucesso."
    });
  };

  const handleDeleteClick = (id: string) => {
    setMetaToDelete(id);
    setDeleteAlertOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (metaToDelete) {
      setMetas(metas.filter(m => m.id !== metaToDelete));
      toast({
        title: "Meta excluída",
        description: "Meta financeira foi removida com sucesso."
      });
    }
    setDeleteAlertOpen(false);
    setMetaToDelete(null);
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return "bg-green-500";
    if (percent >= 75) return "bg-blue-500";
    if (percent >= 50) return "bg-yellow-500";
    return "bg-orange-500";
  };

  const getIcon = (categoria: string) => {
    switch (categoria) {
      case "receita": return <TrendingUp className="h-5 w-5 text-green-500" />;
      case "lucro": return <Wallet className="h-5 w-5 text-blue-500" />;
      case "investimento": return <Target className="h-5 w-5 text-purple-500" />;
      default: return <Target className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6 w-full max-w-none">
      <Card className="vrz-card w-full">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <CardTitle>Metas Financeiras</CardTitle>
              <CardDescription>Acompanhe o progresso dos seus objetivos</CardDescription>
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="vrz-button-primary rounded-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Meta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Definir Nova Meta</DialogTitle>
                  <DialogDescription>Estabeleça um novo objetivo financeiro para sua empresa.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Nome da Meta</Label>
                    <Input 
                      value={novaMeta.nome}
                      onChange={e => setNovaMeta({...novaMeta, nome: e.target.value})}
                      placeholder="Ex: Faturamento 2024"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Valor Alvo (R$)</Label>
                      <Input 
                        type="number"
                        value={novaMeta.alvo}
                        onChange={e => setNovaMeta({...novaMeta, alvo: e.target.value})}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Valor Atual (R$)</Label>
                      <Input 
                        type="number"
                        value={novaMeta.atual}
                        onChange={e => setNovaMeta({...novaMeta, atual: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Prazo</Label>
                    <Input 
                      type="date"
                      value={novaMeta.prazo}
                      onChange={e => setNovaMeta({...novaMeta, prazo: e.target.value})}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full vrz-button-primary rounded-full">Salvar Meta</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Meta</DialogTitle>
                <DialogDescription>Atualize as informações da meta financeira.</DialogDescription>
              </DialogHeader>
              {editingMeta && (
                <form onSubmit={handleEditSubmit} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Nome da Meta</Label>
                    <Input 
                      value={editingMeta.nome}
                      onChange={e => setEditingMeta({...editingMeta, nome: e.target.value})}
                      placeholder="Ex: Faturamento 2024"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Valor Alvo (R$)</Label>
                      <Input 
                        type="number"
                        value={editingMeta.alvo}
                        onChange={e => setEditingMeta({...editingMeta, alvo: Number(e.target.value)})}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Valor Atual (R$)</Label>
                      <Input 
                        type="number"
                        value={editingMeta.atual}
                        onChange={e => setEditingMeta({...editingMeta, atual: Number(e.target.value)})}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Prazo</Label>
                    <Input 
                      type="date"
                      value={editingMeta.prazo}
                      onChange={e => setEditingMeta({...editingMeta, prazo: e.target.value})}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full vrz-button-primary rounded-full">Atualizar Meta</Button>
                </form>
              )}
            </DialogContent>
          </Dialog>

          {/* Delete Alert Dialog */}
          <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Esta meta será permanentemente excluída.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 w-full">
            {metas.map((meta) => {
              const percent = Math.min(Math.round((meta.atual / meta.alvo) * 100), 100);
              const isCompleted = percent >= 100;
              return (
                <Card key={meta.id} className={cn("vrz-card border-2 transition-all", isCompleted && "border-green-500 bg-green-50")}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={cn("p-2 rounded-lg", isCompleted ? "bg-green-100" : "bg-gray-50")}>
                          {getIcon(meta.categoria)}
                        </div>
                        <div>
                          <CardTitle className="text-base">{meta.nome}</CardTitle>
                          <CardDescription>Prazo: {new Date(meta.prazo).toLocaleDateString('pt-BR')}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-2xl font-bold", isCompleted && "text-green-600")}>{percent}%</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleEdit(meta)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteClick(meta.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Progress value={percent} className="h-2" indicatorClassName={isCompleted ? "bg-green-500" : getProgressColor(percent)} />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Atual: <span className="font-medium text-foreground">R$ {meta.atual.toLocaleString('pt-BR')}</span></span>
                        <span className="text-muted-foreground">Alvo: <span className="font-medium text-foreground">R$ {meta.alvo.toLocaleString('pt-BR')}</span></span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

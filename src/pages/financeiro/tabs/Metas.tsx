import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Plus, Target, TrendingUp, Wallet, Pencil, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrencyInput, formatValorToInput, parseCurrencyString } from "@/lib/currencyUtils";

interface Meta {
  id: string;
  nome: string;
  alvo: number;
  atual: number;
  prazo: string;
  categoria: "receita" | "lucro" | "economia" | "investimento";
}

type EditingMeta = Omit<Meta, "alvo" | "atual"> & { alvo: string; atual: string };

export default function Metas() {
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [metaToDelete, setMetaToDelete] = useState<string | null>(null);
  const [editingMeta, setEditingMeta] = useState<EditingMeta | null>(null);

  const [novaMeta, setNovaMeta] = useState({
    nome: "",
    alvo: "",
    atual: "",
    prazo: "",
    categoria: "receita",
  });

  // Fetch Metas
  const { data: metas, isLoading } = useQuery({
    queryKey: ["metas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("metas").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Meta[];
    },
  });

  // Create Meta
  const createMetaMutation = useMutation({
    mutationFn: async (newMeta: Omit<Meta, "id">) => {
      const { error } = await supabase.from("metas").insert(newMeta);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      setIsDialogOpen(false);
      setNovaMeta({ nome: "", alvo: "", atual: "", prazo: "", categoria: "receita" });
      toast.success("Meta criada", { description: "Nova meta financeira estabelecida com sucesso." });
    },
    onError: () => {
      toast.error("Erro ao criar meta");
    },
  });

  // Update Meta
  const updateMetaMutation = useMutation({
    mutationFn: async (meta: Meta) => {
      const { error } = await supabase
        .from("metas")
        .update({
          nome: meta.nome,
          alvo: meta.alvo,
          atual: meta.atual,
          prazo: meta.prazo,
          categoria: meta.categoria,
        })
        .eq("id", meta.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      setIsEditDialogOpen(false);
      setEditingMeta(null);
      toast.success("Meta atualizada", { description: "Meta financeira foi atualizada com sucesso." });
    },
    onError: () => {
      toast.error("Erro ao atualizar meta");
    },
  });

  // Delete Meta
  const deleteMetaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("metas")
        .update({ deleted_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      setDeleteAlertOpen(false);
      setMetaToDelete(null);
      toast.success("Meta excluída", { description: "Meta financeira foi removida com sucesso." });
    },
    onError: () => {
      toast.error("Erro ao excluir meta");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMetaMutation.mutate({
      nome: novaMeta.nome,
      alvo: parseCurrencyString(novaMeta.alvo),
      atual: parseCurrencyString(novaMeta.atual),
      prazo: novaMeta.prazo,
      categoria: novaMeta.categoria as Meta["categoria"],
    });
  };

  const handleEdit = (meta: Meta) => {
    setEditingMeta({
      ...meta,
      prazo: meta.prazo ? meta.prazo.slice(0, 10) : "",
      alvo: formatValorToInput(meta.alvo),
      atual: formatValorToInput(meta.atual),
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMeta) return;
    updateMetaMutation.mutate({
      ...editingMeta,
      alvo: parseCurrencyString(editingMeta.alvo),
      atual: parseCurrencyString(editingMeta.atual),
    });
  };

  const handleDeleteClick = (id: string) => {
    setMetaToDelete(id);
    setDeleteAlertOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (metaToDelete) {
      deleteMetaMutation.mutate(metaToDelete);
    }
  };

  const getIcon = (categoria: string) => {
    switch (categoria) {
      case "receita":
        return <TrendingUp className="h-5 w-5 text-positive" />;
      case "lucro":
        return <Wallet className="h-5 w-5 text-blue-500" />;
      case "investimento":
        return <Target className="h-5 w-5 text-purple-500" />;
      default:
        return <Target className="h-5 w-5 text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-none">
      <Card className="vrz-card w-full">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <CardTitle>Metas</CardTitle>
              <CardDescription>Acompanhe o progresso dos seus objetivos</CardDescription>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-brand hover:bg-brand/90 text-ink rounded-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Meta
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Definir Nova Meta</DialogTitle>
                  <DialogDescription>Estabeleça um novo objetivo financeiro para sua empresa.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Nome da Meta</Label>
                    <Input
                      value={novaMeta.nome}
                      onChange={(e) => setNovaMeta({ ...novaMeta, nome: e.target.value })}
                      placeholder="Ex: Faturamento 2024"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Valor Alvo (R$)</Label>
                      <Input
                        type="text"
                        value={novaMeta.alvo}
                        onChange={(e) => setNovaMeta({ ...novaMeta, alvo: formatCurrencyInput(e.target.value) })}
                        placeholder="R$ 0,00"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Valor Atual (R$)</Label>
                      <Input
                        type="text"
                        value={novaMeta.atual}
                        onChange={(e) => setNovaMeta({ ...novaMeta, atual: formatCurrencyInput(e.target.value) })}
                        placeholder="R$ 0,00"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Prazo</Label>
                    <DatePicker value={novaMeta.prazo} onChange={(v) => setNovaMeta({ ...novaMeta, prazo: v })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <select
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={novaMeta.categoria}
                      onChange={(e) => setNovaMeta({ ...novaMeta, categoria: e.target.value })}
                    >
                      <option value="receita">Receita</option>
                      <option value="lucro">Lucro</option>
                      <option value="economia">Economia</option>
                      <option value="investimento">Investimento</option>
                    </select>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-brand hover:bg-brand/90 text-ink rounded-full"
                    disabled={createMetaMutation.isPending}
                  >
                    {createMetaMutation.isPending ? "Salvando..." : "Salvar Meta"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-md">
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
                      onChange={(e) => setEditingMeta({ ...editingMeta, nome: e.target.value })}
                      placeholder="Ex: Faturamento 2024"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Valor Alvo (R$)</Label>
                      <Input
                        type="text"
                        value={editingMeta.alvo}
                        onChange={(e) => setEditingMeta({ ...editingMeta, alvo: formatCurrencyInput(e.target.value) })}
                        placeholder="R$ 0,00"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Valor Atual (R$)</Label>
                      <Input
                        type="text"
                        value={editingMeta.atual}
                        onChange={(e) => setEditingMeta({ ...editingMeta, atual: formatCurrencyInput(e.target.value) })}
                        placeholder="R$ 0,00"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Prazo</Label>
                    <DatePicker
                      value={editingMeta.prazo}
                      onChange={(v) => setEditingMeta({ ...editingMeta, prazo: v })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <select
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={editingMeta.categoria}
                      onChange={(e) =>
                        setEditingMeta({ ...editingMeta, categoria: e.target.value as Meta["categoria"] })
                      }
                    >
                      <option value="receita">Receita</option>
                      <option value="lucro">Lucro</option>
                      <option value="economia">Economia</option>
                      <option value="investimento">Investimento</option>
                    </select>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-brand hover:bg-brand/90 text-ink rounded-full"
                    disabled={updateMetaMutation.isPending}
                  >
                    {updateMetaMutation.isPending ? "Atualizando..." : "Atualizar Meta"}
                  </Button>
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
                <AlertDialogAction
                  onClick={handleDeleteConfirm}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={deleteMetaMutation.isPending}
                >
                  {deleteMetaMutation.isPending ? "Excluindo..." : "Excluir"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 w-full">
            {metas?.length === 0 && (
              <div className="col-span-full text-center py-10 text-muted-foreground">
                Nenhuma meta cadastrada. Clique em "Nova Meta" para começar.
              </div>
            )}
            {metas?.map((meta) => {
              const percent = Math.min(Math.round((meta.atual / meta.alvo) * 100), 100);
              const isCompleted = percent >= 100;
              return (
                <Card
                  key={meta.id}
                  className={cn("vrz-card border-2 transition-all", isCompleted && "border-status-done bg-positive/10")}
                >
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={cn("p-2 rounded-lg", isCompleted ? "bg-positive/10" : "bg-gray-50")}>
                          {getIcon(meta.categoria)}
                        </div>
                        <div>
                          <CardTitle className="text-base">{meta.nome}</CardTitle>
                          <CardDescription>Prazo: {new Date(meta.prazo).toLocaleDateString("pt-BR")}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-2xl font-bold", isCompleted && "text-positive")}>{percent}%</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(meta)}>
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
                      <Progress value={percent} className="h-2 bg-black" indicatorClassName="bg-positive/100" />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Atual:{" "}
                          <span className="font-medium text-foreground">R$ {meta.atual.toLocaleString("pt-BR")}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Alvo:{" "}
                          <span className="font-medium text-foreground">R$ {meta.alvo.toLocaleString("pt-BR")}</span>
                        </span>
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

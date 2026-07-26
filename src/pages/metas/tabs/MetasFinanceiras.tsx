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

interface Meta {
  id: string;
  nome: string;
  alvo: number;
  atual: number;
  prazo: string;
  categoria: "receita" | "lucro" | "economia" | "investimento";
  tipo: string;
}

export default function MetasFinanceiras() {
  const queryClient = useQueryClient();

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
    categoria: "receita",
    auto_sync: false,
    sync_fonte: "",
  });

  const { data: metas, isLoading } = useQuery({
    queryKey: ["metas", "financeira"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metas")
        .select("*")
        .or("tipo.eq.financeira,tipo.is.null")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Meta[];
    },
  });

  const createMetaMutation = useMutation({
    mutationFn: async (newMeta: Omit<Meta, "id" | "tipo">) => {
      const { error } = await supabase.from("metas").insert({ ...newMeta, tipo: "financeira" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      setIsDialogOpen(false);
      setNovaMeta({ nome: "", alvo: "", atual: "", prazo: "", categoria: "receita", auto_sync: false, sync_fonte: "" });
      toast.success("Meta criada", { description: "Nova meta financeira criada com sucesso." });
    },
    onError: () => {
      toast.error("Erro ao criar meta");
    },
  });

  const updateMetaMutation = useMutation({
    mutationFn: async (meta: Meta) => {
      const { error } = await supabase
        .from("metas")
        .update({ nome: meta.nome, alvo: meta.alvo, atual: meta.atual, prazo: meta.prazo, categoria: meta.categoria })
        .eq("id", meta.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      setIsEditDialogOpen(false);
      setEditingMeta(null);
      toast.success("Meta atualizada", { description: "Meta financeira atualizada com sucesso." });
    },
    onError: () => {
      toast.error("Erro ao atualizar");
    },
  });

  const deleteMetaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("metas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      setDeleteAlertOpen(false);
      setMetaToDelete(null);
      toast.success("Meta excluída", { description: "Meta financeira removida." });
    },
    onError: () => {
      toast.error("Erro ao excluir");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMetaMutation.mutate({
      nome: novaMeta.nome,
      alvo: Number(novaMeta.alvo),
      atual: Number(novaMeta.atual),
      prazo: novaMeta.prazo,
      categoria: novaMeta.categoria as Meta["categoria"],
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMeta) return;
    updateMetaMutation.mutate(editingMeta);
  };

  const getIcon = (categoria: string) => {
    switch (categoria) {
      case "receita":
        return <TrendingUp className="h-5 w-5 text-positive-strong" />;
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
      <Card className="w-full">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <CardTitle>Metas Financeiras</CardTitle>
              <CardDescription>Objetivos de receita, lucro, economia e investimento</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="brand" className="rounded-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Meta
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Nova Meta Financeira</DialogTitle>
                  <DialogDescription>Estabeleça um novo objetivo financeiro.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Nome da Meta</Label>
                    <Input
                      value={novaMeta.nome}
                      onChange={(e) => setNovaMeta({ ...novaMeta, nome: e.target.value })}
                      placeholder="Ex: Faturamento 2026"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Valor Alvo (R$)</Label>
                      <Input
                        type="number"
                        value={novaMeta.alvo}
                        onChange={(e) => setNovaMeta({ ...novaMeta, alvo: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Valor Atual (R$)</Label>
                      <Input
                        type="number"
                        value={novaMeta.atual}
                        onChange={(e) => setNovaMeta({ ...novaMeta, atual: e.target.value })}
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
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      value={novaMeta.categoria}
                      onChange={(e) => setNovaMeta({ ...novaMeta, categoria: e.target.value })}
                    >
                      <option value="receita">Receita</option>
                      <option value="lucro">Lucro</option>
                      <option value="economia">Economia</option>
                      <option value="investimento">Investimento</option>
                    </select>
                  </div>
                  {/* Auto-sync */}
                  <div className="space-y-2 border-t pt-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300"
                        checked={novaMeta.auto_sync}
                        onChange={(e) => setNovaMeta({ ...novaMeta, auto_sync: e.target.checked })}
                      />
                      Sincronizar automaticamente
                    </label>
                    {novaMeta.auto_sync && (
                      <div className="space-y-1">
                        <Label className="text-xs">Fonte de dados</Label>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                          value={novaMeta.sync_fonte}
                          onChange={(e) => setNovaMeta({ ...novaMeta, sync_fonte: e.target.value })}
                        >
                          <option value="">Selecione</option>
                          <option value="receita_total">Receita Total (ano)</option>
                          <option value="receita_mes">Receita do Mês</option>
                          <option value="projetos_concluidos">Projetos Concluídos (ano)</option>
                          <option value="projetos_ativos">Projetos Ativos</option>
                          <option value="margem_media">Margem Média (%)</option>
                          <option value="leads_convertidos">Leads Convertidos (ano)</option>
                          <option value="horas_faturadas">Horas Faturadas (ano)</option>
                        </select>
                        <p className="text-[10px] text-muted-foreground">
                          O valor atual será atualizado ao clicar "Sincronizar"
                        </p>
                      </div>
                    )}
                  </div>

                  <Button
                    type="submit"
                    variant="brand"
                    className="w-full rounded-full"
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
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Valor Alvo (R$)</Label>
                      <Input
                        type="number"
                        value={editingMeta.alvo}
                        onChange={(e) => setEditingMeta({ ...editingMeta, alvo: Number(e.target.value) })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Valor Atual (R$)</Label>
                      <Input
                        type="number"
                        value={editingMeta.atual}
                        onChange={(e) => setEditingMeta({ ...editingMeta, atual: Number(e.target.value) })}
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
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
                    variant="brand"
                    className="w-full rounded-full"
                    disabled={updateMetaMutation.isPending}
                  >
                    {updateMetaMutation.isPending ? "Atualizando..." : "Atualizar Meta"}
                  </Button>
                </form>
              )}
            </DialogContent>
          </Dialog>

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
                  onClick={() => metaToDelete && deleteMetaMutation.mutate(metaToDelete)}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={deleteMetaMutation.isPending}
                >
                  {deleteMetaMutation.isPending ? "Excluindo..." : "Excluir"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 w-full">
            {metas?.length === 0 && (
              <div className="col-span-full text-center py-10 text-muted-foreground">
                Nenhuma meta financeira cadastrada. Clique em "Nova Meta" para começar.
              </div>
            )}
            {metas?.map((meta) => {
              const percent = Math.min(Math.round((meta.atual / meta.alvo) * 100), 100);
              const isCompleted = percent >= 100;
              return (
                <Card
                  key={meta.id}
                  className={cn("border-2 transition-all", isCompleted && "border-status-done bg-positive/10")}
                >
                  <CardContent className="p-4 space-y-3">
                    {/* Linha 1: ações */}
                    <div className="flex items-center justify-between">
                      <div className={cn("p-2 rounded-lg", isCompleted ? "bg-positive/10" : "bg-gray-100")}>
                        {getIcon(meta.categoria)}
                      </div>
                      <div className="flex gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingMeta(meta);
                            setIsEditDialogOpen(true);
                          }}
                          aria-label="Editar meta"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-600"
                          onClick={() => {
                            setMetaToDelete(meta.id);
                            setDeleteAlertOpen(true);
                          }}
                          aria-label="Excluir meta"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Linha 2: nome + % */}
                    <div className="flex items-end justify-between gap-3">
                      <p className="font-semibold text-sm leading-snug flex-1">{meta.nome}</p>
                      <span
                        className={cn(
                          "text-2xl font-bold tabular-nums leading-none shrink-0",
                          isCompleted ? "text-positive-strong" : "text-foreground"
                        )}
                      >
                        {percent}%
                      </span>
                    </div>

                    {/* Linha 3: progress */}
                    <Progress value={percent} className="h-1.5 bg-gray-200" indicatorClassName="bg-positive/100" />

                    {/* Linha 4: prazo + valores */}
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Atual</p>
                        <p className="text-sm font-semibold whitespace-nowrap">
                          R$ {meta.atual.toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground mb-0.5">Alvo</p>
                        <p className="text-sm font-semibold whitespace-nowrap">
                          R$ {meta.alvo.toLocaleString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Prazo: {meta.prazo ? new Date(meta.prazo).toLocaleDateString("pt-BR") : "—"}
                    </p>
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

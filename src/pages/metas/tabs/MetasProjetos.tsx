import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Plus, Calendar, Pencil, Trash2, Loader2 } from "lucide-react";
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
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Projeto {
  id: string;
  nome: string;
}

interface MetaProjeto {
  id: string;
  nome: string;
  alvo: number;
  atual: number;
  prazo: string | null;
  categoria: string | null;
  tipo: string;
  projeto_id: string | null;
  descricao: string | null;
  unidade: string;
}

export default function MetasProjetos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [metaToDelete, setMetaToDelete] = useState<string | null>(null);
  const [editingMeta, setEditingMeta] = useState<MetaProjeto | null>(null);

  const [novaMeta, setNovaMeta] = useState({
    nome: "",
    alvo: "",
    atual: "",
    prazo: "",
    projeto_id: "",
    categoria: "prazo",
    descricao: "",
    unidade: "percentage",
  });

  const { data: projetos } = useQuery({
    queryKey: ["projetos-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos").select("id, nome").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data as Projeto[];
    },
  });

  const { data: metas, isLoading } = useQuery({
    queryKey: ["metas", "projeto"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metas")
        .select("*")
        .eq("tipo", "projeto")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MetaProjeto[];
    },
  });

  const projetoMap = new Map((projetos ?? []).map((p) => [p.id, p.nome]));

  const createMutation = useMutation({
    mutationFn: async (newMeta: Record<string, unknown>) => {
      const { error } = await supabase.from("metas").insert(newMeta);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      setIsDialogOpen(false);
      setNovaMeta({
        nome: "",
        alvo: "",
        atual: "",
        prazo: "",
        projeto_id: "",
        categoria: "prazo",
        descricao: "",
        unidade: "percentage",
      });
      toast({ title: "Meta criada", description: "Meta de projeto criada com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar meta", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (meta: MetaProjeto) => {
      const { error } = await supabase
        .from("metas")
        .update({
          nome: meta.nome,
          alvo: meta.alvo,
          atual: meta.atual,
          prazo: meta.prazo,
          categoria: meta.categoria,
          projeto_id: meta.projeto_id,
          descricao: meta.descricao,
          unidade: meta.unidade,
        })
        .eq("id", meta.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      setIsEditDialogOpen(false);
      setEditingMeta(null);
      toast({ title: "Meta atualizada", description: "Meta de projeto atualizada com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("metas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      setDeleteAlertOpen(false);
      setMetaToDelete(null);
      toast({ title: "Meta excluída", description: "Meta de projeto removida." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      nome: novaMeta.nome,
      alvo: Number(novaMeta.alvo),
      atual: Number(novaMeta.atual),
      prazo: novaMeta.prazo || null,
      projeto_id: novaMeta.projeto_id || null,
      categoria: novaMeta.categoria,
      descricao: novaMeta.descricao || null,
      unidade: novaMeta.unidade,
      tipo: "projeto",
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMeta) return;
    updateMutation.mutate(editingMeta);
  };

  const formatValue = (value: number, unidade: string) => {
    if (unidade === "currency") return `R$ ${value.toLocaleString("pt-BR")}`;
    if (unidade === "percentage") return `${value}%`;
    return value.toLocaleString("pt-BR");
  };

  const getCategoriaColor = (categoria: string | null) => {
    switch (categoria) {
      case "prazo":
        return { icon: "text-orange-500", bg: "bg-orange-50" };
      case "custo":
        return { icon: "text-green-500", bg: "bg-green-50" };
      case "qualidade":
        return { icon: "text-blue-500", bg: "bg-blue-50" };
      case "escopo":
        return { icon: "text-purple-500", bg: "bg-purple-50" };
      default:
        return { icon: "text-gray-500", bg: "bg-gray-50" };
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const metaFormFields = (
    values: Record<string, string | number | null>,
    onChange: (field: string, value: string | number | null) => void
  ) => (
    <>
      <div className="space-y-2">
        <Label>Projeto</Label>
        <select
          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          value={values.projeto_id ?? ""}
          onChange={(e) => onChange("projeto_id", e.target.value || null)}
        >
          <option value="">Selecione um projeto</option>
          {(projetos ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Nome da Meta</Label>
        <Input
          value={values.nome}
          onChange={(e) => onChange("nome", e.target.value)}
          placeholder="Ex: Conclusão no prazo"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Input
          value={values.descricao ?? ""}
          onChange={(e) => onChange("descricao", e.target.value)}
          placeholder="Descreva o objetivo do projeto"
        />
      </div>
      <div className="space-y-2">
        <Label>Unidade</Label>
        <select
          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          value={values.unidade ?? "percentage"}
          onChange={(e) => onChange("unidade", e.target.value)}
        >
          <option value="currency">Valor (R$)</option>
          <option value="percentage">Percentual (%)</option>
          <option value="quantity">Quantidade</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Alvo</Label>
          <Input type="number" value={values.alvo} onChange={(e) => onChange("alvo", e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Atual</Label>
          <Input type="number" value={values.atual} onChange={(e) => onChange("atual", e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Prazo</Label>
          <Input type="date" value={values.prazo ?? ""} onChange={(e) => onChange("prazo", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Categoria</Label>
          <select
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            value={values.categoria ?? "prazo"}
            onChange={(e) => onChange("categoria", e.target.value)}
          >
            <option value="prazo">Prazo</option>
            <option value="custo">Custo</option>
            <option value="qualidade">Qualidade</option>
            <option value="escopo">Escopo</option>
          </select>
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-6 w-full max-w-none">
      <Card className="vrz-card w-full">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <CardTitle>Metas de Projetos</CardTitle>
              <CardDescription>Acompanhe objetivos de prazo, custo, qualidade e escopo</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-accent-orange hover:bg-accent-orange/90 text-white rounded-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Meta
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Nova Meta de Projeto</DialogTitle>
                  <DialogDescription>Defina um objetivo para o projeto.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                  {metaFormFields(novaMeta, (field, value) => setNovaMeta({ ...novaMeta, [field]: value }))}
                  <Button
                    type="submit"
                    className="w-full bg-accent-orange hover:bg-accent-orange/90 text-white rounded-full"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? "Salvando..." : "Salvar Meta"}
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
                <DialogTitle>Editar Meta de Projeto</DialogTitle>
                <DialogDescription>Atualize as informações da meta.</DialogDescription>
              </DialogHeader>
              {editingMeta && (
                <form onSubmit={handleEditSubmit} className="space-y-4 mt-4">
                  {metaFormFields(editingMeta, (field, value) =>
                    setEditingMeta({
                      ...editingMeta,
                      [field]: field === "alvo" || field === "atual" ? Number(value) : value,
                    })
                  )}
                  <Button
                    type="submit"
                    className="w-full bg-accent-orange hover:bg-accent-orange/90 text-white rounded-full"
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? "Atualizando..." : "Atualizar Meta"}
                  </Button>
                </form>
              )}
            </DialogContent>
          </Dialog>

          <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                <AlertDialogDescription>Esta meta será permanentemente excluída.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => metaToDelete && deleteMutation.mutate(metaToDelete)}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 w-full">
            {metas?.length === 0 && (
              <div className="col-span-full text-center py-10 text-muted-foreground">
                Nenhuma meta de projeto cadastrada. Clique em "Nova Meta" para começar.
              </div>
            )}
            {metas?.map((meta) => {
              const percent = Math.min(Math.round((meta.atual / meta.alvo) * 100), 100);
              const isCompleted = percent >= 100;
              const projetoNome = meta.projeto_id ? projetoMap.get(meta.projeto_id) : null;
              const colors = getCategoriaColor(meta.categoria);
              return (
                <Card
                  key={meta.id}
                  className={cn("vrz-card border-2 transition-all", isCompleted && "border-green-500 bg-green-50")}
                >
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={cn("p-2 rounded-lg", isCompleted ? "bg-green-100" : colors.bg)}>
                          <Calendar className={cn("h-5 w-5", isCompleted ? "text-green-500" : colors.icon)} />
                        </div>
                        <div>
                          <CardTitle className="text-base">{meta.nome}</CardTitle>
                          {projetoNome && <CardDescription>{projetoNome}</CardDescription>}
                          {meta.prazo && (
                            <CardDescription>Prazo: {new Date(meta.prazo).toLocaleDateString("pt-BR")}</CardDescription>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-2xl font-bold", isCompleted && "text-green-600")}>{percent}%</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingMeta(meta);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700"
                          onClick={() => {
                            setMetaToDelete(meta.id);
                            setDeleteAlertOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Progress
                        value={percent}
                        className="h-2 bg-gray-100"
                        indicatorClassName={isCompleted ? "bg-green-500" : "bg-purple-500"}
                      />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Atual:{" "}
                          <span className="font-medium text-foreground">{formatValue(meta.atual, meta.unidade)}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Alvo:{" "}
                          <span className="font-medium text-foreground">{formatValue(meta.alvo, meta.unidade)}</span>
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

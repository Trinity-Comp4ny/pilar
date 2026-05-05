import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Plus, User, Pencil, Trash2, Loader2 } from "lucide-react";
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
import { fetchPessoasLookup } from "@/lib/supabaseQueries";

interface MetaPessoal {
  id: string;
  nome: string;
  alvo: number;
  atual: number;
  prazo: string | null;
  categoria: string | null;
  tipo: string;
  pessoa_id: string | null;
  descricao: string | null;
  unidade: string;
}

export default function MetasPessoais() {
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [metaToDelete, setMetaToDelete] = useState<string | null>(null);
  const [editingMeta, setEditingMeta] = useState<MetaPessoal | null>(null);

  const [novaMeta, setNovaMeta] = useState({
    nome: "",
    alvo: "",
    atual: "",
    prazo: "",
    pessoa_id: "",
    categoria: "entregas",
    descricao: "",
    unidade: "quantity",
  });

  const { data: pessoas } = useQuery({
    queryKey: ["pessoas-list"],
    queryFn: fetchPessoasLookup,
  });

  const { data: metas, isLoading } = useQuery({
    queryKey: ["metas", "pessoal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metas")
        .select("*")
        .eq("tipo", "pessoal")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MetaPessoal[];
    },
  });

  const pessoaMap = new Map((pessoas ?? []).map((p) => [p.id, p.nome]));

  const createMutation = useMutation({
    mutationFn: async (newMeta: Record<string, unknown>) => {
      const { error } = await supabase.from("metas").insert(newMeta as never);
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
        pessoa_id: "",
        categoria: "entregas",
        descricao: "",
        unidade: "quantity",
      });
      toast.success("Meta criada", { description: "Meta pessoal criada com sucesso." });
    },
    onError: () => {
      toast.error("Erro ao criar meta");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (meta: MetaPessoal) => {
      const { error } = await supabase
        .from("metas")
        .update({
          nome: meta.nome,
          alvo: meta.alvo,
          atual: meta.atual,
          prazo: meta.prazo,
          categoria: meta.categoria,
          pessoa_id: meta.pessoa_id,
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
      toast.success("Meta atualizada", { description: "Meta pessoal atualizada com sucesso." });
    },
    onError: () => {
      toast.error("Erro ao atualizar");
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
      toast.success("Meta excluída", { description: "Meta pessoal removida." });
    },
    onError: () => {
      toast.error("Erro ao excluir");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      nome: novaMeta.nome,
      alvo: Number(novaMeta.alvo),
      atual: Number(novaMeta.atual),
      prazo: novaMeta.prazo || null,
      pessoa_id: novaMeta.pessoa_id || null,
      categoria: novaMeta.categoria,
      descricao: novaMeta.descricao || null,
      unidade: novaMeta.unidade,
      tipo: "pessoal",
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
        <Label>Colaborador</Label>
        <select
          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          value={values.pessoa_id ?? ""}
          onChange={(e) => onChange("pessoa_id", e.target.value || null)}
        >
          <option value="">Selecione um colaborador</option>
          {(pessoas ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Nome da Meta</Label>
        <Input
          value={(values.nome as string | number) ?? ""}
          onChange={(e) => onChange("nome", e.target.value)}
          placeholder="Ex: Entregas no prazo"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Input
          value={values.descricao ?? ""}
          onChange={(e) => onChange("descricao", e.target.value)}
          placeholder="Descreva o objetivo"
        />
      </div>
      <div className="space-y-2">
        <Label>Unidade</Label>
        <select
          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          value={values.unidade ?? "quantity"}
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
          <Input
            type="number"
            value={(values.alvo as string | number) ?? 0}
            onChange={(e) => onChange("alvo", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Atual</Label>
          <Input
            type="number"
            value={(values.atual as string | number) ?? 0}
            onChange={(e) => onChange("atual", e.target.value)}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Prazo</Label>
          <DatePicker value={String(values.prazo ?? "")} onChange={(v) => onChange("prazo", v)} />
        </div>
        <div className="space-y-2">
          <Label>Categoria</Label>
          <select
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            value={values.categoria ?? "entregas"}
            onChange={(e) => onChange("categoria", e.target.value)}
          >
            <option value="entregas">Entregas</option>
            <option value="qualidade">Qualidade</option>
            <option value="produtividade">Produtividade</option>
            <option value="desenvolvimento">Desenvolvimento</option>
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
              <CardTitle>Metas Pessoais</CardTitle>
              <CardDescription>Acompanhe o desempenho individual dos colaboradores</CardDescription>
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
                  <DialogTitle>Nova Meta Pessoal</DialogTitle>
                  <DialogDescription>Defina uma meta para um colaborador.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                  {metaFormFields(novaMeta, (field, value) => setNovaMeta({ ...novaMeta, [field]: value }))}
                  <Button
                    type="submit"
                    className="w-full bg-brand hover:bg-brand/90 text-ink rounded-full"
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
                <DialogTitle>Editar Meta Pessoal</DialogTitle>
                <DialogDescription>Atualize as informações da meta.</DialogDescription>
              </DialogHeader>
              {editingMeta && (
                <form onSubmit={handleEditSubmit} className="space-y-4 mt-4">
                  {metaFormFields(editingMeta as unknown as Record<string, string | number | null>, (field, value) =>
                    setEditingMeta({
                      ...editingMeta,
                      [field]: field === "alvo" || field === "atual" ? Number(value) : value,
                    } as MetaPessoal)
                  )}
                  <Button
                    type="submit"
                    className="w-full bg-brand hover:bg-brand/90 text-ink rounded-full"
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
                Nenhuma meta pessoal cadastrada. Clique em "Nova Meta" para começar.
              </div>
            )}
            {metas?.map((meta) => {
              const percent = Math.min(Math.round((meta.atual / meta.alvo) * 100), 100);
              const isCompleted = percent >= 100;
              const pessoaNome = meta.pessoa_id ? pessoaMap.get(meta.pessoa_id) : null;
              return (
                <Card
                  key={meta.id}
                  className={cn("vrz-card border-2 transition-all", isCompleted && "border-status-done bg-positive/10")}
                >
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={cn("p-2 rounded-lg", isCompleted ? "bg-positive/10" : "bg-blue-50")}>
                          <User className={cn("h-5 w-5", isCompleted ? "text-positive" : "text-blue-500")} />
                        </div>
                        <div>
                          <CardTitle className="text-base">{meta.nome}</CardTitle>
                          {pessoaNome && <CardDescription>{pessoaNome}</CardDescription>}
                          {meta.prazo && (
                            <CardDescription>Prazo: {new Date(meta.prazo).toLocaleDateString("pt-BR")}</CardDescription>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-2xl font-bold", isCompleted && "text-positive")}>{percent}%</span>
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
                        indicatorClassName={isCompleted ? "bg-positive/100" : "bg-blue-500"}
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

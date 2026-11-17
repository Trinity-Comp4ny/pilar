import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/safeError";
import { softDelete } from "@/lib/softDelete";

interface Categoria {
  id: string;
  nome: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Categorias de receita ou de despesa: cada lançamento só enxerga as do seu tipo. */
  tipo: "Receita" | "Despesa";
}

/** Cria, renomeia e exclui categorias financeiras sem sair do lançamento. */
export function CategoriaManager({ open, onOpenChange, tipo }: Props) {
  const queryClient = useQueryClient();
  const [list, setList] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Categoria | null>(null);
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Categoria | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("categorias_financeiras")
      .select("id, nome")
      .eq("tipo", tipo)
      .is("deleted_at", null)
      .order("nome");
    if (error) {
      toast.error("Não foi possível carregar as categorias", {
        description: getSafeErrorMessage(error, "Atualize a página em instantes."),
      });
    }
    setList((data ?? []) as Categoria[]);
    setLoading(false);
  }, [tipo]);

  useEffect(() => {
    if (open) void fetchAll();
  }, [open, fetchAll]);

  const refreshAux = () => queryClient.invalidateQueries({ queryKey: ["finance-aux-data"] });

  const startNew = () => {
    setEditing(null);
    setNome("");
  };

  const submit = async () => {
    const limpo = nome.trim();
    if (!limpo) {
      toast.error("Informe o nome da categoria");
      return;
    }
    if (list.some((c) => c.id !== editing?.id && c.nome.toLowerCase() === limpo.toLowerCase())) {
      toast.error("Já existe uma categoria com esse nome");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from("categorias_financeiras").update({ nome: limpo }).eq("id", editing.id);
        if (error) throw error;
        toast.success("Categoria atualizada");
      } else {
        const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
        if (!empresaId) throw new Error("Sem empresa");
        const { error } = await supabase.from("categorias_financeiras").insert({ nome: limpo, tipo, empresa_id: empresaId });
        if (error) throw error;
        toast.success("Categoria criada");
      }
      startNew();
      await fetchAll();
      await refreshAux();
    } catch (e) {
      toast.error("Não foi possível salvar", {
        description: getSafeErrorMessage(e, "Confira o nome e tente de novo."),
      });
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (c: Categoria) => {
    // Via RPC: a policy de SELECT esconde linha deletada, UPDATE direto leva 42501.
    const error = await softDelete("categorias_financeiras", c.id);
    if (error) {
      toast.error("Não foi possível excluir", {
        description: getSafeErrorMessage(error, "Tente de novo em instantes."),
      });
      return;
    }
    toast.success("Categoria excluída");
    if (editing?.id === c.id) startNew();
    await fetchAll();
    await refreshAux();
  };

  const rotulo = tipo === "Receita" ? "receita" : "despesa";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Categorias de {rotulo}</DialogTitle>
            <DialogDescription>Crie as categorias que aparecem ao lançar {rotulo}s no financeiro.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-3">
              <div className="text-sm font-medium">{editing ? "Editar" : "Nova categoria"}</div>
              <div>
                <Label htmlFor="categoria-nome">Nome *</Label>
                <Input
                  id="categoria-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void submit();
                    }
                  }}
                  placeholder="Ex: Aluguel, Software, Impostos"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="brand" onClick={submit} loading={saving} className="flex-1">
                  {editing ? "Atualizar" : "Criar"}
                </Button>
                {editing && (
                  <Button variant="outline" onClick={startNew} aria-label="Cancelar edição">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Lista ({list.length})</div>
                <Button size="sm" variant="ghost" onClick={startNew} className="gap-1">
                  <Plus className="h-3 w-3" /> Nova
                </Button>
              </div>
              <div className="border rounded max-h-80 overflow-y-auto divide-y">
                {loading && <Spinner size="sm" label="Carregando categorias" className="p-3" />}
                {!loading && list.length === 0 && (
                  <EmptyState
                    icon={Tags}
                    title="Nenhuma categoria cadastrada"
                    description={`Crie a primeira categoria de ${rotulo}.`}
                    className="py-8"
                  />
                )}
                {list.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 p-2 text-sm hover:bg-muted/30">
                    <span className="flex-1 min-w-0 truncate font-medium">{c.nome}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditing(c);
                        setNome(c.nome);
                      }}
                      aria-label={`Editar ${c.nome}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-danger-mid"
                      onClick={() => setDeleteTarget(c)}
                      aria-label={`Excluir ${c.nome}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Excluir categoria"
        description={`Excluir "${deleteTarget?.nome}"? Os lançamentos que já usam essa categoria continuam como estão.`}
        confirmText="Excluir"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) void excluir(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

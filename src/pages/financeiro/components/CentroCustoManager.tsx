import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface CentroCusto {
  id: string;
  codigo: string | null;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
}

export function CentroCustoManager({ open, onOpenChange, onChanged }: Props) {
  const [list, setList] = useState<CentroCusto[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<CentroCusto | null>(null);
  const [form, setForm] = useState({ codigo: "", nome: "", descricao: "" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CentroCusto | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("centros_custo")
      .select("id, codigo, nome, descricao, ativo")
      .is("deleted_at", null)
      .order("nome");
    if (error) toast.error("Erro ao carregar centros");
    setList((data ?? []) as CentroCusto[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchAll();
  }, [open]);

  const startEdit = (c: CentroCusto) => {
    setEditing(c);
    setForm({ codigo: c.codigo ?? "", nome: c.nome, descricao: c.descricao ?? "" });
  };

  const startNew = () => {
    setEditing(null);
    setForm({ codigo: "", nome: "", descricao: "" });
  };

  const submit = async () => {
    if (!form.nome.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    setSaving(true);
    try {
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Sem empresa");

      const payload = {
        codigo: form.codigo.trim() || null,
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
      };

      if (editing) {
        const { error } = await supabase.from("centros_custo").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Centro atualizado");
      } else {
        const { error } = await supabase.from("centros_custo").insert({
          ...payload,
          empresa_id: empresaId,
        });
        if (error) throw error;
        toast.success("Centro criado");
      }
      setEditing(null);
      setForm({ codigo: "", nome: "", descricao: "" });
      await fetchAll();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  const softDelete = async (c: CentroCusto) => {
    const { error } = await supabase
      .from("centros_custo")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", c.id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Centro excluído");
    await fetchAll();
    onChanged?.();
  };

  const toggleAtivo = async (c: CentroCusto) => {
    const { error } = await supabase.from("centros_custo").update({ ativo: !c.ativo }).eq("id", c.id);
    if (error) {
      toast.error("Erro");
      return;
    }
    await fetchAll();
    onChanged?.();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Centros de custo</DialogTitle>
            <DialogDescription>Dimensão usada para classificar despesas por área/projeto/filial.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-3">
              <div className="text-sm font-medium">{editing ? "Editar" : "Novo"}</div>
              <div>
                <Label>Código (opcional)</Label>
                <Input
                  value={form.codigo}
                  onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                  placeholder="Ex: ADM, COM, PROJ-A"
                />
              </div>
              <div>
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <Button onClick={submit} disabled={saving} className="flex-1">
                  {saving ? "Salvando..." : editing ? "Atualizar" : "Criar"}
                </Button>
                {editing && (
                  <Button variant="outline" onClick={startNew}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Lista ({list.length})</div>
                <Button size="sm" variant="ghost" onClick={startNew} className="gap-1">
                  <Plus className="h-3 w-3" /> Novo
                </Button>
              </div>
              <div className="border rounded max-h-80 overflow-y-auto divide-y">
                {loading && <div className="p-3 text-xs text-muted-foreground">Carregando...</div>}
                {!loading && list.length === 0 && (
                  <div className="p-3 text-xs text-muted-foreground">Nenhum centro cadastrado</div>
                )}
                {list.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 p-2 text-sm hover:bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{c.nome}</span>
                        {c.codigo && (
                          <Badge variant="outline" className="text-[10px]">
                            {c.codigo}
                          </Badge>
                        )}
                        {!c.ativo && (
                          <Badge variant="secondary" className="text-[10px]">
                            inativo
                          </Badge>
                        )}
                      </div>
                      {c.descricao && <div className="text-xs text-muted-foreground truncate">{c.descricao}</div>}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleAtivo(c)}
                      title={c.ativo ? "Desativar" : "Ativar"}
                      aria-label={c.ativo ? "Desativar" : "Ativar"}
                    >
                      <span className="text-[10px]">{c.ativo ? "ON" : "OFF"}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => startEdit(c)}
                      aria-label="Editar centro de custo"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600"
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
        title="Excluir centro de custo"
        description={`Excluir "${deleteTarget?.nome}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) void softDelete(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

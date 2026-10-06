import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, Plus, Search, Layers, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { reportError } from "@/lib/reportError";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export interface DisciplinaCatalogo {
  id: string;
  nome: string;
  empresa_id: string | null;
}

interface ManageDisciplinasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disciplinas: DisciplinaCatalogo[];
  onDisciplinasChanged: () => void;
}

export function ManageDisciplinasDialog({
  open,
  onOpenChange,
  disciplinas,
  onDisciplinasChanged,
}: ManageDisciplinasDialogProps) {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newDisciplina, setNewDisciplina] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<DisciplinaCatalogo | null>(null);
  const [editName, setEditName] = useState("");
  const [editing, setEditing] = useState(false);

  const filtered = disciplinas.filter((d) => d.nome.toLowerCase().includes(search.toLowerCase()));
  const hasDuplicate = (nome: string, ignoreId?: string) =>
    disciplinas.some((d) => d.id !== ignoreId && d.nome.toLowerCase() === nome.toLowerCase());

  const handleAdd = async () => {
    const nome = newDisciplina.trim();
    if (!nome) return;
    if (hasDuplicate(nome)) {
      toast.error("Já existe uma disciplina com este nome");
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("disciplinas").insert({ nome });
    setAdding(false);
    if (error) {
      const { message } = reportError(error, { context: "disciplina:criar", extra: { nome } });
      toast.error("Não foi possível adicionar a disciplina", { description: message });
    } else {
      toast.success("Disciplina adicionada");
      setNewDisciplina("");
      setAddOpen(false);
      onDisciplinasChanged();
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("disciplinas").delete().eq("id", deleteId);
    if (error) {
      const { message } = reportError(error, { context: "disciplina:excluir", extra: { id: deleteId } });
      toast.error("Não foi possível excluir a disciplina", { description: message });
    } else {
      toast.success("Disciplina excluída");
      onDisciplinasChanged();
    }
    setDeleteId(null);
  };

  const openEdit = (disciplina: DisciplinaCatalogo) => {
    if (!disciplina.empresa_id) return;
    setEditTarget(disciplina);
    setEditName(disciplina.nome);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    const nome = editName.trim();
    if (!nome) return;
    if (hasDuplicate(nome, editTarget.id)) {
      toast.error("Já existe uma disciplina com este nome");
      return;
    }

    setEditing(true);
    const { error } = await supabase.from("disciplinas").update({ nome }).eq("id", editTarget.id);
    setEditing(false);
    if (error) {
      const { message } = reportError(error, {
        context: "disciplina:editar",
        extra: { id: editTarget.id, nome },
      });
      toast.error("Não foi possível editar a disciplina", { description: message });
    } else {
      toast.success("Disciplina atualizada");
      setEditTarget(null);
      setEditName("");
      onDisciplinasChanged();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Gerenciar Disciplinas
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Header actions */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar disciplina..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Button size="sm" variant="brand" className="h-9 px-3 gap-1.5 shrink-0" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </div>

            {/* List */}
            <div className="border rounded-lg overflow-hidden">
              <div className="divide-y h-[340px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    {search ? `Nenhuma disciplina encontrada para "${search}"` : "Nenhuma disciplina cadastrada"}
                  </div>
                ) : (
                  filtered.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-muted transition-colors group"
                    >
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-medium">{d.nome}</span>
                        {!d.empresa_id && <span className="text-[11px] text-muted-foreground">Padrão do sistema</span>}
                      </div>
                      {d.empresa_id && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-ink"
                            onClick={() => openEdit(d)}
                            aria-label={`Editar disciplina ${d.nome}`}
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-danger-mid"
                            onClick={() => setDeleteId(d.id)}
                            aria-label={`Excluir disciplina ${d.nome}`}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-right">
              {disciplinas.length} disciplina{disciplinas.length !== 1 ? "s" : ""} cadastrada
              {disciplinas.length !== 1 ? "s" : ""}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: adicionar */}
      <Dialog
        open={addOpen}
        onOpenChange={(v) => {
          setAddOpen(v);
          if (!v) setNewDisciplina("");
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova disciplina</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Nome *</Label>
              <Input
                placeholder="Ex: Estrutural"
                value={newDisciplina}
                onChange={(e) => setNewDisciplina(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                autoFocus
                className="h-10"
              />
            </div>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button variant="brand" onClick={handleAdd} disabled={adding || !newDisciplina.trim()}>
              {adding ? "Adicionando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: editar */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(v) => {
          if (!v) {
            setEditTarget(null);
            setEditName("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar disciplina</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Nome *</Label>
              <Input
                placeholder="Ex: Estrutural"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEdit()}
                autoFocus
                className="h-10"
              />
            </div>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancelar
            </Button>
            <Button variant="brand" onClick={handleEdit} disabled={editing || !editName.trim()}>
              {editing ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => {
          if (!v) setDeleteId(null);
        }}
        onConfirm={handleDelete}
        title="Excluir disciplina?"
        description="Esta ação não pode ser desfeita. Projetos que já usam esta disciplina não serão afetados."
        confirmText="Excluir"
      />
    </>
  );
}

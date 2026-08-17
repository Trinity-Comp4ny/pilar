import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, Plus, Search, Layers } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface ManageDisciplinasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disciplinas: { id: string; nome: string }[];
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

  const filtered = disciplinas.filter((d) => d.nome.toLowerCase().includes(search.toLowerCase()));

  const handleAdd = async () => {
    const nome = newDisciplina.trim();
    if (!nome) return;
    if (disciplinas.some((d) => d.nome.toLowerCase() === nome.toLowerCase())) {
      toast.error("Já existe uma disciplina com este nome");
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("disciplinas").insert({ nome });
    setAdding(false);
    if (error) {
      toast.error("Erro ao adicionar disciplina");
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
      toast.error("Erro ao excluir disciplina");
    } else {
      toast.success("Disciplina excluída");
      onDisciplinasChanged();
    }
    setDeleteId(null);
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
              <Button
                size="sm"
                variant="brand"
                className="h-9 px-3 gap-1.5 flex-shrink-0"
                onClick={() => setAddOpen(true)}
              >
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
                      <span className="text-sm font-medium">{d.nome}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-danger-mid opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setDeleteId(d.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
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

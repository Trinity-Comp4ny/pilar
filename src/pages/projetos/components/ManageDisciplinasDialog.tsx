import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  const [newDisciplina, setNewDisciplina] = useState("");

  const handleAdd = async () => {
    if (!newDisciplina.trim()) return;

    const { error } = await supabase.from("disciplinas").insert({ nome: newDisciplina });

    if (error) {
      toast.error("Erro ao adicionar disciplina");
    } else {
      toast.success("Disciplina adicionada");
      setNewDisciplina("");
      onDisciplinasChanged();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("disciplinas").delete().eq("id", id);
    if (!error) {
      onDisciplinasChanged();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar Disciplinas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Nova disciplina..."
              value={newDisciplina}
              onChange={(e) => setNewDisciplina(e.target.value)}
            />
            <Button onClick={handleAdd}>Adicionar</Button>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {disciplinas.map((d) => (
              <div key={d.id} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                <span>{d.nome}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 h-6 w-6 p-0"
                  onClick={() => handleDelete(d.id)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

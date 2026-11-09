import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";

interface NovaDisciplina {
  disciplina: string;
  responsavel_id: string;
}

interface DisciplinaNovaLinhaProps {
  value: NovaDisciplina;
  onChange: (updater: (prev: NovaDisciplina) => NovaDisciplina) => void;
  disciplinasCatalog: { id: string; nome: string }[];
  pessoas: { id: string; nome: string }[];
  onAdd: () => void;
  onCancel: () => void;
}

/** Linha de "adicionar disciplina" no fim da tabela (extraRows do DataTable, SPEC 127). */
export function DisciplinaNovaLinha({
  value: newDisc,
  onChange,
  disciplinasCatalog,
  pessoas,
  onAdd,
  onCancel,
}: DisciplinaNovaLinhaProps) {
  const setNewDisc = onChange;
  return (
    <TableRow className="bg-primary/5">
      <TableCell className="py-2">
        <Select value={newDisc.disciplina} onValueChange={(v) => setNewDisc((p) => ({ ...p, disciplina: v }))}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {disciplinasCatalog.map((d) => (
              <SelectItem key={d.id} value={d.nome} className="text-xs">
                {d.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="py-2 text-xs text-muted-foreground" colSpan={5}>
        Defina os outros campos após adicionar
      </TableCell>
      <TableCell className="py-2" colSpan={2}>
        <Select value={newDisc.responsavel_id} onValueChange={(v) => setNewDisc((p) => ({ ...p, responsavel_id: v }))}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            {pessoas.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-xs">
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="py-2">
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="brand"
            className="h-8 w-8"
            onClick={onAdd}
            disabled={!newDisc.disciplina || !newDisc.responsavel_id}
            aria-label="Adicionar disciplina"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onCancel} aria-label="Cancelar">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

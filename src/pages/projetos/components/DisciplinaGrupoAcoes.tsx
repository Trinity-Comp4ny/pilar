import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { reportError } from "@/lib/reportError";
import type { Projeto } from "@/types/projetos";
import {
  excluirDisciplina,
  nomeJaExiste,
  renomearDisciplina,
  usosDaDisciplina,
  type CatalogoLinha,
} from "@/pages/projetos/lib/disciplinaEmLote";

interface Props {
  nome: string;
  /** Todos os projetos, sem filtro da tela: renomear e excluir valem para todos. */
  projetos: Projeto[];
  catalogo: CatalogoLinha[];
  onChanged: () => void;
}

/** Menu de um grupo da aba Disciplinas: renomear e excluir, no catálogo e em todos os projetos. */
export function DisciplinaGrupoAcoes({ nome, projetos, catalogo, onChanged }: Props) {
  const [renomeando, setRenomeando] = useState(false);
  const [novoNome, setNovoNome] = useState(nome);
  const [excluindo, setExcluindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const usos = usosDaDisciplina(projetos, nome);

  const salvarNome = async () => {
    const limpo = novoNome.trim();
    if (!limpo || limpo === nome) {
      setRenomeando(false);
      return;
    }
    if (nomeJaExiste(limpo, { projetos, catalogo, ignorar: nome })) {
      toast.error("Já existe uma disciplina com este nome");
      return;
    }
    setSalvando(true);
    try {
      await renomearDisciplina({ nome, novoNome: limpo, projetos, catalogo });
      toast.success("Disciplina renomeada");
      setRenomeando(false);
      onChanged();
    } catch (error) {
      const { message } = reportError(error, { context: "disciplina:renomear-em-lote", extra: { nome } });
      toast.error("Não foi possível renomear a disciplina", { description: message });
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExclusao = async () => {
    setSalvando(true);
    try {
      await excluirDisciplina({ nome, projetos, catalogo });
      toast.success("Disciplina excluída");
      setExcluindo(false);
      onChanged();
    } catch (error) {
      const { message } = reportError(error, { context: "disciplina:excluir-em-lote", extra: { nome } });
      toast.error("Não foi possível excluir a disciplina", { description: message });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Ações da disciplina ${nome}`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setNovoNome(nome);
              setRenomeando(true);
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Renomear
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setExcluindo(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renomeando} onOpenChange={setRenomeando}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Renomear disciplina</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-1.5">
            <Label className="text-sm">Nome *</Label>
            <Input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && salvarNome()}
              autoFocus
              className="h-10"
            />
            {usos.projetos > 0 && (
              <p className="text-xs text-muted-foreground">
                O novo nome vale em {usos.projetos} projeto{usos.projetos !== 1 ? "s" : ""}.
              </p>
            )}
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setRenomeando(false)}>
              Cancelar
            </Button>
            <Button variant="brand" onClick={salvarNome} loading={salvando} disabled={!novoNome.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={excluindo}
        onOpenChange={setExcluindo}
        onConfirm={confirmarExclusao}
        title="Excluir disciplina?"
        itemName={nome}
        description={
          usos.projetos > 0
            ? `Ela está em ${usos.projetos} projeto${usos.projetos !== 1 ? "s" : ""} e será removida de todos, com responsáveis, checklist e histórico. Não dá para desfazer.`
            : "Não dá para desfazer."
        }
        confirmText="Excluir"
        loading={salvando}
      />
    </>
  );
}

import { useState } from "react";
import { FormDialog } from "@/components/FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColumnColorPicker } from "@/components/kanban/ColumnColorPicker";

export type ColunaEditavel = { id: string; nome: string; cor: string };

interface EditColumnDialogProps {
  /** Coluna em edição; `null` fecha o modal. `cor` já vem resolvida (a que aparece no quadro). */
  coluna: ColunaEditavel | null;
  onClose: () => void;
  colors: readonly string[];
  /** Persiste nome + cor. Retorna `true` no sucesso, para fechar o modal. */
  onSave: (coluna: ColunaEditavel) => Promise<boolean>;
  isPending: boolean;
  placeholder?: string;
}

/** Editar coluna do quadro (nome + cor). Compartilhado por Projetos e Meu Trabalho. */
export function EditColumnDialog({ coluna, onClose, colors, onSave, isPending, placeholder }: EditColumnDialogProps) {
  const [nome, setNome] = useState(coluna?.nome ?? "");
  const [cor, setCor] = useState(coluna?.cor ?? "");
  // Reinicia os campos ao abrir outra coluna (ajuste no render, sem effect).
  const [abertaPara, setAbertaPara] = useState(coluna);
  if (coluna !== abertaPara) {
    setAbertaPara(coluna);
    if (coluna) {
      setNome(coluna.nome);
      setCor(coluna.cor);
    }
  }

  const salvar = async () => {
    if (!coluna) return;
    const limpo = nome.trim();
    if (!limpo) return;
    const ok = await onSave({ id: coluna.id, nome: limpo, cor });
    if (ok) onClose();
  };

  return (
    <FormDialog
      open={!!coluna}
      onOpenChange={(open) => !open && onClose()}
      title="Editar coluna"
      size="sm"
      onSubmit={salvar}
      isPending={isPending}
      submitDisabled={!nome.trim()}
    >
      <div className="space-y-1.5">
        <Label htmlFor="etapa-nome">Nome da coluna</Label>
        <Input
          id="etapa-nome"
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={placeholder}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Cor</Label>
        <ColumnColorPicker colors={colors} value={cor} onChange={setCor} />
      </div>
    </FormDialog>
  );
}

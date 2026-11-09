import { useState } from "react";
import { FormDialog } from "@/components/FormDialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface PausarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Vira também o rótulo do botão de confirmar ("Pausar projeto"). */
  title: string;
  description: string;
  /** O que a pausa faz além de parar o projeto (ex.: quantas disciplinas pausam). */
  aviso?: string;
  dica?: string;
  isPending: boolean;
  onConfirmar: (motivo: string) => void;
}

/** Diálogo de pausa de projeto e de disciplina: motivo obrigatório, sempre o mesmo formulário (spec 141). */
export function PausarDialog({
  open,
  onOpenChange,
  title,
  description,
  aviso,
  dica = "O motivo fica no histórico. O cliente não vê.",
  isPending,
  onConfirmar,
}: PausarDialogProps) {
  const [motivo, setMotivo] = useState("");

  // Cada abertura começa com o motivo em branco (ajuste de estado durante o render, sem efeito).
  const [abertoAntes, setAbertoAntes] = useState(open);
  if (open !== abertoAntes) {
    setAbertoAntes(open);
    if (open) setMotivo("");
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      onSubmit={() => onConfirmar(motivo.trim())}
      submitLabel={title}
      isPending={isPending}
      submitDisabled={!motivo.trim()}
    >
      <div className="space-y-3">
        {aviso && <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">{aviso}</p>}
        <div className="space-y-2">
          <Label htmlFor="motivo-pausa">Motivo da pausa</Label>
          <Textarea
            id="motivo-pausa"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: cliente suspendeu a obra até a liberação do financiamento"
            rows={3}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">{dica}</p>
        </div>
      </div>
    </FormDialog>
  );
}

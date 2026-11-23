import { AlertTriangle } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import type { DisciplinaResponsavel } from "@/types/projetos";

interface Props {
  disciplinas: DisciplinaResponsavel[];
  concludingDiscIdx: number | null;
  setConcludingDiscIdx: (v: number | null) => void;
  concludingDate: string;
  setConcludingDate: (v: string) => void;
  onConcluir: (idx: number, date: string) => Promise<unknown> | void;
  justificativaDialog: { discIdx: number; newStatus: string } | null;
  setJustificativaDialog: (v: { discIdx: number; newStatus: string } | null) => void;
  justificativaText: string;
  setJustificativaText: (v: string) => void;
  onJustificativaConfirm: () => void;
}

/** Confirmações de conclusão e de justificativa de atraso de uma disciplina. */
export function DisciplinaConfirmDialogs({
  disciplinas,
  concludingDiscIdx,
  setConcludingDiscIdx,
  concludingDate,
  setConcludingDate,
  onConcluir,
  justificativaDialog,
  setJustificativaDialog,
  justificativaText,
  setJustificativaText,
  onJustificativaConfirm,
}: Props) {
  return (
    <>
      {/* Confirmação de conclusão */}
      <AlertDialog
        open={concludingDiscIdx !== null}
        onOpenChange={(o) => {
          if (!o) setConcludingDiscIdx(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar conclusão</AlertDialogTitle>
            <AlertDialogDescription>
              A disciplina <strong>{concludingDiscIdx !== null && disciplinas[concludingDiscIdx]?.disciplina}</strong>{" "}
              será marcada como <strong>Concluída</strong>. Informe a data real da entrega abaixo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 py-2">
            <Label className="text-xs">Data final</Label>
            <DatePicker
              value={concludingDate || undefined}
              onChange={(v) => setConcludingDate(v || "")}
              maxDate={new Date().toISOString().split("T")[0]}
            />
            <p className="text-2xs text-muted-foreground">
              Use a data em que o trabalho foi de fato entregue, não a data administrativa de hoje.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!concludingDate}
              onClick={async () => {
                if (concludingDiscIdx === null || !concludingDate) return;
                const idx = concludingDiscIdx;
                const date = concludingDate;
                setConcludingDiscIdx(null);
                await onConcluir(idx, date);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Justificativa de atraso */}
      <AlertDialog
        open={!!justificativaDialog}
        onOpenChange={(o) => {
          if (!o) {
            setJustificativaDialog(null);
            setJustificativaText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-danger-mid" />
              Justificativa de atraso obrigatória
            </AlertDialogTitle>
            <AlertDialogDescription>
              A disciplina{" "}
              <strong>{justificativaDialog !== null && disciplinas[justificativaDialog.discIdx]?.disciplina}</strong>{" "}
              está atrasada. Informe a justificativa para continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label className="text-sm mb-2 block">Justificativa</Label>
            <Textarea
              value={justificativaText}
              onChange={(e) => setJustificativaText(e.target.value)}
              placeholder="Explique o motivo do atraso..."
              className="min-h-[80px]"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onJustificativaConfirm} disabled={!justificativaText.trim()}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function DisciplinaExcluirDialog({
  nome,
  open,
  onClose,
  onConfirm,
}: {
  nome?: string;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir disciplina</AlertDialogTitle>
          <AlertDialogDescription>
            {nome
              ? `A disciplina "${nome}" e seus dados serão removidos. Esta ação não pode ser desfeita.`
              : "Esta ação não pode ser desfeita."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={onConfirm}>
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

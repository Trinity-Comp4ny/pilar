import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, FileText, Loader2, UserPlus } from "lucide-react";

// --- Motivo de Perda ---

type MotivoPerdasProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  motivoPerda: string;
  onMotivoChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function LeadMotivoPerdasDialog({
  open,
  onOpenChange,
  motivoPerda,
  onMotivoChange,
  onConfirm,
  onCancel,
}: MotivoPerdasProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-chart-danger" />
            Motivo da Perda
          </DialogTitle>
          <DialogDescription>
            Por que este lead foi perdido? Isso ajuda a analisar seu funil comercial.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <Textarea
            value={motivoPerda}
            onChange={(e) => onMotivoChange(e.target.value)}
            placeholder="Ex: Preço acima do orçamento, escolheu concorrente, projeto cancelado..."
            rows={3}
          />
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} variant="destructive" disabled={!motivoPerda.trim()}>
            Confirmar Perda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Auto Convert (drag para Ganho) ---

type AutoConvertProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onConvert: () => void;
  onSkip: () => void;
};

export function LeadAutoConvertDialog({ open, onOpenChange, isPending, onConvert, onSkip }: AutoConvertProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-positive-strong" />
            Lead Ganho!
          </DialogTitle>
          <DialogDescription>
            Deseja criar um cliente automaticamente a partir deste lead? Os dados de contato serão copiados.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 flex gap-2">
          <Button variant="outline" onClick={onSkip}>
            Apenas marcar como Ganho
          </Button>
          <Button onClick={onConvert} className="bg-positive hover:bg-positive/90 text-white" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Convertendo...
              </>
            ) : (
              "Criar cliente"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Criar Proposta ---

type CreatePropostaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadNome: string;
  isPending: boolean;
  onConfirm: () => void;
};

export function LeadCreatePropostaDialog({ open, onOpenChange, leadNome, isPending, onConfirm }: CreatePropostaProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-foreground" />
            Criar proposta
          </DialogTitle>
          <DialogDescription>
            Deseja criar uma proposta para <span className="font-medium text-foreground">{leadNome}</span>? Você será
            redirecionado para o editor de propostas.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant="brand" onClick={onConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando...
              </>
            ) : (
              "Confirmar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

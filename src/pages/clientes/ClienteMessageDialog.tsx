import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Cliente } from "@/hooks/useClientes";

interface ClienteMessageDialogProps {
  open: boolean;
  cliente: Cliente | null;
  subject: string;
  message: string;
  onSubjectChange: (v: string) => void;
  onMessageChange: (v: string) => void;
  onCancel: () => void;
  onSend: () => void;
  onOpenChange: (open: boolean) => void;
}

export function ClienteMessageDialog({
  open,
  cliente,
  subject,
  message,
  onSubjectChange,
  onMessageChange,
  onCancel,
  onSend,
  onOpenChange,
}: ClienteMessageDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Mensagem</DialogTitle>
          <DialogDescription>Enviar mensagem para {cliente?.nome}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Assunto</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              placeholder="Assunto"
            />
          </div>
        </div>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              placeholder="Digite sua mensagem aqui..."
              rows={4}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={onSend}
            className="flex-1 bg-brand hover:bg-brand/90 text-ink"
            disabled={!message || !subject || !cliente}
          >
            Enviar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { FormDialog } from "@/components/FormDialog";
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
  onSend: () => void | Promise<void>;
  /** Fecha o dialog. Chamado tanto pelo Cancelar quanto por Escape/overlay/X, sempre reseta os campos no pai. */
  onOpenChange: (open: boolean) => void;
}

export function ClienteMessageDialog({
  open,
  cliente,
  subject,
  message,
  onSubjectChange,
  onMessageChange,
  onSend,
  onOpenChange,
}: ClienteMessageDialogProps) {
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (isSending) return;
    setIsSending(true);
    try {
      await onSend();
    } finally {
      setIsSending(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Enviar mensagem"
      description={
        <>
          Enviar mensagem para {cliente?.nome}
          {cliente?.sobrenome ? ` ${cliente.sobrenome}` : ""}
        </>
      }
      size="md"
      onSubmit={handleSend}
      isPending={isSending}
      submitDisabled={!message || !subject || !cliente}
      submitLabel="Enviar"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="subject">Assunto</Label>
          <Input id="subject" value={subject} onChange={(e) => onSubjectChange(e.target.value)} placeholder="Assunto" />
        </div>
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
    </FormDialog>
  );
}

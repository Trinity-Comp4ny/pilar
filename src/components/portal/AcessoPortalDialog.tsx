import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FormDialog } from "@/components/FormDialog";
import { PageLoader } from "@/components/motion/PageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClientes } from "@/hooks/useClientes";
import { linkDoPortal, useAcessoPortal } from "@/hooks/useAcessoPortal";
import { useRequireAal2 } from "@/hooks/useRequireAal2";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface AcessoPortalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  clienteNome: string;
  /** E-mail do cadastro do cliente; vem preenchido e pode ser trocado na hora. */
  clienteEmail?: string | null;
}

/**
 * Dá acesso ao portal sem sair da tela: convida, reenvia o convite pendente ou
 * manda um novo acesso. Só admin e coordenador chegam aqui (o botão e as edge
 * functions conferem o papel).
 */
export function AcessoPortalDialog({
  open,
  onOpenChange,
  clienteId,
  clienteNome,
  clienteEmail,
}: AcessoPortalDialogProps) {
  const queryClient = useQueryClient();
  const requireAal2 = useRequireAal2();
  const { data: acesso, isLoading } = useAcessoPortal(clienteId, open);
  const { invitePortal, isInvitingPortal, resetPortalPassword, isResettingPortal } = useClientes({
    enableListQueries: false,
  });
  // null = ainda não mexeu: vale o e-mail do cadastro.
  const [emailDigitado, setEmailDigitado] = useState<string | null>(null);
  const email = emailDigitado ?? clienteEmail ?? "";
  const fechar = (aberto: boolean) => {
    if (!aberto) setEmailDigitado(null);
    onOpenChange(aberto);
  };

  const atualizar = () => {
    queryClient.invalidateQueries({ queryKey: ["portal-acesso", clienteId] });
    queryClient.invalidateQueries({ queryKey: ["portal-status", clienteId] });
    queryClient.invalidateQueries({ queryKey: ["portal-status-por-cliente"] });
  };

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(linkDoPortal());
      toast.success("Link do portal copiado");
    } catch {
      toast.error("Não foi possível copiar", { description: linkDoPortal() });
    }
  };

  const convidar = async () => {
    const destino = email.trim().toLowerCase();
    if (!EMAIL_RE.test(destino)) return;
    if (!(await requireAal2())) return;
    try {
      const r = await invitePortal({ clienteId, email: destino });
      // Cliente sem e-mail no cadastro: guarda o que foi digitado, para a próxima vez.
      if (!clienteEmail) {
        await supabase.from("clientes").update({ email: r.email }).eq("id", clienteId);
        queryClient.invalidateQueries({ queryKey: ["clientes"] });
        queryClient.invalidateQueries({ queryKey: ["projeto-detail"] });
      }
      toast.success("Convite enviado", { description: `${clienteNome} recebe o link em ${r.email}.` });
      atualizar();
      fechar(false);
    } catch {
      // erro já mostrado pelo hook
    }
  };

  const reenviar = async () => {
    if (!(await requireAal2())) return;
    try {
      const r = await resetPortalPassword({ clienteId, nomeCliente: clienteNome });
      toast.success("Novo link enviado", { description: `Enviado para ${r.email}.` });
      atualizar();
      fechar(false);
    } catch {
      // erro já mostrado pelo hook
    }
  };

  const status = acesso?.status ?? "sem_acesso";
  const emailValido = EMAIL_RE.test(email.trim());

  const submit = {
    sem_acesso: { label: "Enviar convite", acao: convidar, disabled: !emailValido },
    convite_pendente: { label: "Reenviar convite", acao: reenviar, disabled: false },
    ativo: { label: "Copiar link do portal", acao: copiarLink, disabled: false },
  }[status];

  return (
    <FormDialog
      open={open}
      onOpenChange={fechar}
      title="Acesso ao portal do cliente"
      description={`${clienteNome} acompanha os projetos dele com o escritório: andamento, entregas e parcelas.`}
      onSubmit={submit.acao}
      submitLabel={submit.label}
      submitDisabled={isLoading || submit.disabled}
      isPending={isInvitingPortal || isResettingPortal}
    >
      {isLoading ? (
        <PageLoader />
      ) : status === "sem_acesso" ? (
        <div className="space-y-2">
          <Label htmlFor="portal-email">E-mail do cliente</Label>
          <Input
            id="portal-email"
            type="email"
            autoFocus
            value={email}
            onChange={(e) => setEmailDigitado(e.target.value)}
            placeholder="cliente@email.com"
          />
          <p className="text-xs text-muted-foreground">
            O cliente recebe um link para criar a senha. Ele vê todos os projetos dele neste escritório.
          </p>
        </div>
      ) : status === "convite_pendente" ? (
        <div className="flex items-start gap-2 rounded-lg border border-warning-mid-border bg-warning-soft px-3 py-2.5 text-sm text-warning-strong">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Convite enviado para <strong>{acesso?.email}</strong>, ainda não aceito. Reenvie se o cliente não achou o
            e-mail.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-positive/20 bg-positive/10 px-3 py-2.5 text-sm text-positive-strong">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              O cliente já acessa o portal com <strong>{acesso?.email}</strong>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={reenviar} loading={isResettingPortal}>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Enviar novo acesso
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Novo acesso troca a senha: o cliente cria outra pelo link.</p>
        </div>
      )}
    </FormDialog>
  );
}

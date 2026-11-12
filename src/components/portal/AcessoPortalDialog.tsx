import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Copy, Send, ShieldOff, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FormDialog } from "@/components/FormDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageLoader } from "@/components/motion/PageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClientes } from "@/hooks/useClientes";
import {
  type AcessoPortal,
  chaveAcessosPortal,
  linkDoPortal,
  revogarAcessoPortal,
  useAcessosPortal,
} from "@/hooks/useAcessoPortal";
import { useRequireAal2 } from "@/hooks/useRequireAal2";
import { formatDateTime } from "@/lib/format";
import { getSafeErrorMessage } from "@/lib/safeError";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface AcessoPortalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  clienteNome: string;
  /** E-mail do cadastro do cliente: vem preenchido no primeiro convite, para o admin conferir. */
  clienteEmail?: string | null;
}

/**
 * Acessos ao portal do cliente (SPEC 164): um por e-mail, vários por cliente. Lista quem
 * já entra (ou tem convite pendente), reenvia e revoga cada um, e convida mais gente (a
 * esposa, o sócio). Só admin e coordenador chegam aqui (o botão e as edge functions
 * conferem o papel).
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
  const { data: acessos = [], isLoading } = useAcessosPortal(clienteId, open);
  const { invitePortal, isInvitingPortal, resetPortalPassword } = useClientes({ enableListQueries: false });

  // null = ainda não mexeu: vale a sugestão (e-mail do cadastro, se ninguém usa ainda).
  const [emailDigitado, setEmailDigitado] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [reenviando, setReenviando] = useState<string | null>(null);
  const [revogar, setRevogar] = useState<AcessoPortal | null>(null);
  const [revogando, setRevogando] = useState(false);

  const cadastroJaTemAcesso = !!clienteEmail && acessos.some((a) => a.email === clienteEmail.toLowerCase());
  const sugestao = acessos.length === 0 && clienteEmail && !cadastroJaTemAcesso ? clienteEmail : "";
  const email = emailDigitado ?? sugestao;
  const veioDoCadastro = emailDigitado === null && !!sugestao;
  const emailValido = EMAIL_RE.test(email.trim());

  const limpar = () => {
    setEmailDigitado(null);
    setNome("");
  };
  const fechar = (aberto: boolean) => {
    if (!aberto) limpar();
    onOpenChange(aberto);
  };

  const atualizar = () => {
    queryClient.invalidateQueries({ queryKey: chaveAcessosPortal(clienteId) });
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
      const r = await invitePortal({ clienteId, email: destino, nome: nome.trim() || undefined });
      // Cliente sem e-mail no cadastro: guarda o primeiro, para a próxima vez.
      if (!clienteEmail && acessos.length === 0) {
        await supabase.from("clientes").update({ email: r.email }).eq("id", clienteId);
        queryClient.invalidateQueries({ queryKey: ["clientes"] });
        queryClient.invalidateQueries({ queryKey: ["projeto-detail"] });
      }
      toast.success("Convite enviado", { description: `${nome.trim() || clienteNome} recebe o link em ${r.email}.` });
      atualizar();
      limpar();
    } catch {
      // erro já mostrado pelo hook
    }
  };

  const reenviar = async (acesso: AcessoPortal) => {
    if (!(await requireAal2())) return;
    setReenviando(acesso.id);
    try {
      const r = await resetPortalPassword({ clienteId, nomeCliente: clienteNome, accountId: acesso.id });
      toast.success(acesso.status === "ativo" ? "Novo acesso enviado" : "Convite reenviado", {
        description: `Enviado para ${r.email}.`,
      });
      atualizar();
    } catch {
      // erro já mostrado pelo hook
    } finally {
      setReenviando(null);
    }
  };

  const confirmarRevogar = async () => {
    if (!revogar) return;
    if (!(await requireAal2())) return;
    setRevogando(true);
    try {
      await revogarAcessoPortal(revogar.id);
      toast.success("Acesso revogado", { description: `${revogar.email} não entra mais no portal.` });
      atualizar();
      setRevogar(null);
    } catch (e) {
      toast.error("Não foi possível revogar o acesso", { description: getSafeErrorMessage(e, "Tente novamente.") });
    } finally {
      setRevogando(false);
    }
  };

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={fechar}
        title="Acesso ao portal do cliente"
        description={`${clienteNome} acompanha os projetos com o escritório: andamento, entregas e parcelas. Cada pessoa entra com o próprio e-mail e senha.`}
        onSubmit={convidar}
        submitLabel="Enviar convite"
        submitDisabled={isLoading || !emailValido}
        isPending={isInvitingPortal}
      >
        {isLoading ? (
          <PageLoader />
        ) : (
          <div className="space-y-5">
            {acessos.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">Quem tem acesso</p>
                  <Button type="button" variant="ghost" size="sm" onClick={copiarLink}>
                    <Copy className="h-3.5 w-3.5" />
                    Copiar link do portal
                  </Button>
                </div>
                <ul className="divide-y rounded-lg border" aria-label="Acessos ao portal">
                  {acessos.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                      {a.status === "ativo" ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-positive-strong" aria-label="Acesso ativo" />
                      ) : (
                        <Clock className="h-4 w-4 shrink-0 text-warning-strong" aria-label="Convite pendente" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{a.email}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {a.nome && a.nome !== clienteNome ? `${a.nome} · ` : ""}
                          {a.status === "ativo"
                            ? a.ultimoAcesso
                              ? `Último acesso em ${formatDateTime(a.ultimoAcesso)}`
                              : "Senha criada"
                            : "Convite enviado, ainda não aceito"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => reenviar(a)}
                        loading={reenviando === a.id}
                        disabled={!!reenviando}
                        aria-label={`${a.status === "ativo" ? "Enviar novo acesso" : "Reenviar convite"} para ${a.email}`}
                      >
                        <Send className="h-3.5 w-3.5" />
                        {a.status === "ativo" ? "Novo acesso" : "Reenviar"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-danger-strong"
                        onClick={() => setRevogar(a)}
                        aria-label={`Revogar o acesso de ${a.email}`}
                      >
                        <ShieldOff className="h-3.5 w-3.5" />
                        Revogar
                      </Button>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  "Novo acesso" troca a senha da pessoa: ela cria outra pelo link do e-mail.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                <UserPlus className="h-4 w-4" />
                {acessos.length ? "Dar acesso a mais alguém" : "Convidar o cliente"}
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="portal-email">E-mail</Label>
                <Input
                  id="portal-email"
                  type="email"
                  autoFocus={acessos.length === 0}
                  value={email}
                  onChange={(e) => setEmailDigitado(e.target.value)}
                  placeholder="pessoa@email.com"
                />
                {veioDoCadastro && (
                  <p className="text-xs text-muted-foreground">
                    Puxado do cadastro do cliente. Confira antes de enviar.
                  </p>
                )}
              </div>
              {acessos.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="portal-nome">Quem é (opcional)</Label>
                  <Input
                    id="portal-nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex.: Maria, esposa"
                    maxLength={200}
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                A pessoa recebe um link por e-mail para criar a senha e vê todos os projetos de {clienteNome} neste
                escritório.
              </p>
            </div>
          </div>
        )}
      </FormDialog>

      <ConfirmDialog
        open={!!revogar}
        onOpenChange={(aberto) => !aberto && setRevogar(null)}
        onConfirm={confirmarRevogar}
        loading={revogando}
        variant="destructive"
        title="Revogar este acesso?"
        description="A pessoa deixa de entrar no portal. Os outros acessos do cliente continuam valendo."
        itemName={revogar?.email}
        confirmText="Revogar"
      />
    </>
  );
}

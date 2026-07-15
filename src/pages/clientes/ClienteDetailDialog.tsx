import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Landmark,
  Globe,
  KeyRound,
  Loader2,
  Pencil,
  Trash2,
  ShieldOff,
  Send,
} from "lucide-react";
import { formatDocument } from "@/lib/maskUtils";
import type { Cliente } from "@/hooks/useClientes";

type PortalStatus = "idle" | "loading" | "exists" | "none";

interface PortalCredentials {
  email: string;
}

interface ClienteDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: Cliente | null;
  isAdmin: boolean;

  portalStatus: PortalStatus;
  portalCredentials: PortalCredentials | null;
  resetCredentials: PortalCredentials | null;
  isInvitingPortal: boolean;
  isResettingPortal: boolean;
  isRevokingPortal: boolean;

  onInvitePortal: () => void;
  onResetPortalPassword: () => void;
  onRevokePortal: () => void;
  onEdit: (cliente: Cliente) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function CredentialsBox({ credentials, variant }: { credentials: PortalCredentials; variant: "success" | "reset" }) {
  const styles =
    variant === "success"
      ? { box: "bg-positive/10 border-positive/20", title: "text-positive-strong", desc: "text-positive-strong" }
      : { box: "bg-amber-50 border-amber-200", title: "text-amber-800", desc: "text-amber-700" };

  return (
    <div className={`space-y-2 border rounded-lg p-4 ${styles.box}`}>
      <p className={`text-sm font-medium ${styles.title}`}>
        {variant === "success" ? "Acesso criado com sucesso!" : "Senha redefinida!"}
      </p>
      <p className={`text-xs ${styles.desc}`}>
        As credenciais foram enviadas para <strong>{credentials.email}</strong> por email.
      </p>
    </div>
  );
}

export function ClienteDetailDialog({
  open,
  onOpenChange,
  cliente,
  isAdmin,
  portalStatus,
  portalCredentials,
  resetCredentials,
  isInvitingPortal,
  isResettingPortal,
  isRevokingPortal,
  onInvitePortal,
  onResetPortalPassword,
  onRevokePortal,
  onEdit,
  onDelete,
}: ClienteDetailDialogProps) {
  const [confirmPortalOpen, setConfirmPortalOpen] = useState(false);

  if (!cliente) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg" />
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {cliente.nome}
              {cliente.sobrenome ? ` ${cliente.sobrenome}` : ""}
            </DialogTitle>
            <DialogDescription>Detalhes do cliente</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">CPF/CNPJ</Label>
                <p className="font-medium">{formatDocument(cliente.cpf_cnpj)}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Origem</Label>
                <p className="font-medium">{cliente.origem || "-"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tipo NF</Label>
                <p className="font-medium">{cliente.tipo_nf || "-"}</p>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <User size={14} /> Contato
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={14} className="text-muted-foreground" />
                  {cliente.email || "Não informado"}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone size={14} className="text-muted-foreground" />
                  {cliente.contato || "Não informado"}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin size={14} className="text-muted-foreground" />
                  {cliente.endereco || "Não informado"}
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="space-y-3 mt-4 pt-4 border-t">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Globe size={14} /> Portal do Cliente
                </Label>

                {portalStatus === "loading" && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 size={14} className="animate-spin" /> Verificando...
                  </div>
                )}

                {portalStatus === "exists" && !portalCredentials && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 bg-positive/10 border border-positive/20 rounded-lg px-3 py-2 text-sm text-positive-strong">
                      <Globe size={14} />
                      <span className="flex-1">Cliente possui acesso ao portal</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onResetPortalPassword}
                        disabled={isResettingPortal || isRevokingPortal}
                        className="flex-1"
                      >
                        {isResettingPortal ? (
                          <Loader2 size={14} className="animate-spin mr-1.5" />
                        ) : (
                          <KeyRound size={14} className="mr-1.5" />
                        )}
                        {isResettingPortal ? "Redefinindo..." : "Redefinir senha"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onRevokePortal}
                        disabled={isRevokingPortal || isResettingPortal}
                        className="border-red-200 text-red-700 hover:bg-red-50"
                      >
                        {isRevokingPortal ? (
                          <Loader2 size={14} className="animate-spin mr-1.5" />
                        ) : (
                          <ShieldOff size={14} className="mr-1.5" />
                        )}
                        {isRevokingPortal ? "Revogando..." : "Revogar"}
                      </Button>
                    </div>
                    {resetCredentials && <CredentialsBox credentials={resetCredentials} variant="reset" />}
                  </div>
                )}

                {portalCredentials && <CredentialsBox credentials={portalCredentials} variant="success" />}

                {portalStatus === "none" && !portalCredentials && (
                  <div className="space-y-2">
                    {cliente.email ? (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Criar acesso ao portal para{" "}
                          <span className="font-medium text-foreground">{cliente.email}</span>
                        </p>
                        <Button
                          size="sm"
                          onClick={() => setConfirmPortalOpen(true)}
                          disabled={isInvitingPortal}
                          className="bg-brand hover:bg-brand/90 text-ink"
                        >
                          {isInvitingPortal ? (
                            <Loader2 size={14} className="animate-spin mr-1.5" />
                          ) : (
                            <Globe size={14} className="mr-1.5" />
                          )}
                          {isInvitingPortal ? "Criando..." : "Criar acesso ao portal"}
                        </Button>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        Cadastre um email para este cliente antes de criar o acesso ao portal.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2 mt-4 pt-4 border-t">
              <Label className="text-sm font-medium">Contas Bancárias</Label>
              {cliente.contas_bancarias && cliente.contas_bancarias.length > 0 ? (
                <div className="space-y-2">
                  {cliente.contas_bancarias.map((conta, index) => (
                    <div
                      key={`${conta.banco}-${conta.agencia}-${conta.conta}-${index}`}
                      className={`flex items-center justify-between gap-3 bg-gray-50 border rounded-lg px-3 py-2 text-sm ${
                        conta.is_primary ? "border-brand/50 bg-brand/5" : "border-gray-200"
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-1.5 rounded-full bg-white border border-gray-100 text-gray-500">
                          <Landmark size={14} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{conta.banco}</span>
                            {conta.is_primary && (
                              <span className="text-[10px] bg-brand/10 text-brand px-1.5 py-0.5 rounded font-medium">
                                Principal
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Ag: {conta.agencia}</span>
                            <span className="text-gray-300">|</span>
                            <span>Cc: {conta.conta}</span>
                            <span className="text-gray-300">|</span>
                            <span className="capitalize">{conta.tipo}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Nenhuma conta bancária cadastrada.</p>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              {isAdmin && (
                <>
                  <Button variant="secondary" onClick={() => onEdit(cliente)} className="flex-1">
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                  <Button variant="destructive" onClick={() => onDelete(cliente.id)} className="flex-1">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmPortalOpen} onOpenChange={setConfirmPortalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Criar acesso ao portal?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Será criada uma conta de acesso ao Portal do Cliente para{" "}
                  <span className="font-medium text-foreground">
                    {cliente.nome}
                    {cliente.sobrenome ? ` ${cliente.sobrenome}` : ""}
                  </span>
                  .
                </p>
                <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-blue-800">
                  <Send size={14} className="mt-0.5 shrink-0" />
                  <p>
                    As credenciais de acesso (email e senha) serão enviadas automaticamente para{" "}
                    <strong>{cliente.email}</strong>.
                  </p>
                </div>
                <p>O cliente poderá acessar o status do projeto, entregas e informações financeiras.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmPortalOpen(false);
                onInvitePortal();
              }}
              className="bg-brand hover:bg-brand/90 text-ink"
            >
              <Send size={14} className="mr-1.5" />
              Criar e enviar por email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

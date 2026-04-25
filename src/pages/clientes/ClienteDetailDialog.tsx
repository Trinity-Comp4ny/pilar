import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { User, Mail, Phone, MapPin, Landmark, Globe, KeyRound, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDocument } from "@/lib/maskUtils";
import type { Cliente } from "@/hooks/useClientes";

type PortalStatus = "idle" | "loading" | "exists" | "none";

interface PortalCredentials {
  email: string;
  senha: string;
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

  onInvitePortal: () => void;
  onResetPortalPassword: () => void;
  onEdit: (cliente: Cliente) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function CredentialsBox({ credentials, variant }: { credentials: PortalCredentials; variant: "success" | "reset" }) {
  const copyText = () => {
    const text = `Portal do Cliente Pilar\n\nEmail: ${credentials.email}\nSenha: ${credentials.senha}\nLink: ${window.location.origin}/cliente/login`;
    navigator.clipboard.writeText(text);
    toast.success("Copiado!", { description: "Credenciais copiadas para a área de transferência." });
  };

  const styles =
    variant === "success"
      ? { box: "bg-green-50 border-green-200", title: "text-green-800", desc: "text-green-700" }
      : { box: "bg-amber-50 border-amber-200", title: "text-amber-800", desc: "text-amber-700" };

  return (
    <div className={`space-y-3 border rounded-lg p-4 ${styles.box}`}>
      <p className={`text-sm font-medium ${styles.title}`}>
        {variant === "success" ? "Acesso criado com sucesso!" : "Senha redefinida!"}
      </p>
      <p className={`text-xs ${styles.desc}`}>
        {variant === "success"
          ? "Envie as credenciais abaixo para o cliente:"
          : "Envie as novas credenciais ao cliente. A senha não será exibida novamente:"}
      </p>
      <div className="bg-white rounded border p-3 space-y-1.5 font-mono text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Email:</span>
          <span className="font-medium">{credentials.email}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Senha:</span>
          <span className="font-medium">{credentials.senha}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Link:</span>
          <span className="font-medium text-xs">{window.location.origin}/cliente/login</span>
        </div>
      </div>
      <Button size="sm" variant="outline" className="w-full" onClick={copyText}>
        Copiar credenciais
      </Button>
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
  onInvitePortal,
  onResetPortalPassword,
  onEdit,
  onDelete,
  onClose,
}: ClienteDetailDialogProps) {
  if (!cliente) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg" />
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{cliente.nome}</DialogTitle>
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
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800">
                    <Globe size={14} />
                    <span className="flex-1">Cliente possui acesso ao portal</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onResetPortalPassword}
                    disabled={isResettingPortal}
                    className="w-full"
                  >
                    {isResettingPortal ? (
                      <Loader2 size={14} className="animate-spin mr-1.5" />
                    ) : (
                      <KeyRound size={14} className="mr-1.5" />
                    )}
                    {isResettingPortal ? "Redefinindo..." : "Redefinir senha"}
                  </Button>
                  {resetCredentials && <CredentialsBox credentials={resetCredentials} variant="reset" />}
                </div>
              )}

              {portalCredentials && <CredentialsBox credentials={portalCredentials} variant="success" />}

              {portalStatus === "none" && !portalCredentials && (
                <div className="space-y-2">
                  {cliente.email ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Criar acesso ao portal para <span className="font-medium text-foreground">{cliente.email}</span>
                      </p>
                      <Button
                        size="sm"
                        onClick={onInvitePortal}
                        disabled={isInvitingPortal}
                        className="bg-accent-orange hover:bg-accent-orange/90 text-ink"
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
                      conta.is_primary ? "border-accent-orange/50 bg-accent-orange/5" : "border-gray-200"
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
                            <span className="text-[10px] bg-accent-orange/10 text-accent-orange px-1.5 py-0.5 rounded font-medium">
                              Principal
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-black/60">
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
            <Button variant="outline" onClick={onClose} className="flex-1">
              Fechar
            </Button>
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
  );
}

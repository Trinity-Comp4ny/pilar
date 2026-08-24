import { useEffect, useState } from "react";
import { Pencil, Trash2, UserPlus, Users as UsersIcon, ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PilarRole } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: PilarRole;
  isPending?: boolean;
  /** id do convite (quando isPending) — necessário para reenviar/cancelar */
  inviteId?: string | null;
};

/**
 * Acesso é role + módulo habilitado na empresa (ADR 0029): não existe mais
 * nível por feature no usuário, então a UI edita só o tipo de conta.
 */
const ROLE_BADGE: Record<PilarRole, string> = {
  ultra_admin: "Ultra admin",
  admin: "Admin da empresa",
  user: "Usuário",
};

/** Convite/edição via UI: apenas admin ou user. ultra_admin só por SQL. */
export type AssignableRole = Exclude<PilarRole, "ultra_admin">;

export type InvitePayload = {
  name: string;
  email: string;
  role: AssignableRole;
};

export type UpdatePayload = {
  id: string;
  role: AssignableRole;
};

export type UsersAccessManagerProps = {
  users: ManagedUser[];
  currentUserId: string | null;
  canManage: boolean;
  isInviting?: boolean;
  /** Executado antes de abrir os modais de convite/edição (ex.: gate AAL2). Retorna false para cancelar. */
  onRequireAuth?: () => Promise<boolean>;
  onInvite: (payload: InvitePayload) => void | Promise<void>;
  onUpdate: (payload: UpdatePayload) => void;
  onDelete: (userId: string) => void;
  /** Reenviar convite pendente (opcional — só habilita a ação se fornecido) */
  onResendInvite?: (user: ManagedUser) => void | Promise<void>;
  /** Cancelar convite pendente (opcional) */
  onCancelInvite?: (user: ManagedUser) => void | Promise<void>;
};

export function UsersAccessManager({
  users,
  currentUserId,
  canManage,
  isInviting = false,
  onRequireAuth,
  onInvite,
  onUpdate,
  onDelete,
  onResendInvite,
  onCancelInvite,
}: UsersAccessManagerProps) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ManagedUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);

  // Gate de auth (AAL2) roda ANTES de abrir o modal, para não perder o formulário preenchido.
  const openInvite = async () => {
    if (onRequireAuth && !(await onRequireAuth())) return;
    setInviteOpen(true);
  };
  const openEdit = async (user: ManagedUser) => {
    if (onRequireAuth && !(await onRequireAuth())) return;
    setEditTarget(user);
  };

  return (
    <Card className="border border-black/5">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon size={20} strokeWidth={1.5} />
            Usuários da Empresa
          </CardTitle>
          <CardDescription>Convide quem trabalha com você e defina quem administra a conta.</CardDescription>
        </div>
        {canManage && (
          <Button type="button" onClick={openInvite} variant="brand" className="rounded-full">
            <UserPlus size={16} strokeWidth={1.75} />
            Convidar usuário
          </Button>
        )}
      </CardHeader>

      <CardContent>
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tipo de conta</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-black/50">
                    Nenhum usuário adicionado.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => {
                  const isUltra = u.role === "ultra_admin";
                  return (
                    <TableRow key={u.id} className={u.isPending ? "opacity-70" : ""}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="line-clamp-1">{u.name}</span>
                          {u.isPending && <Badge variant="secondary">Pendente</Badge>}
                          {u.id === currentUserId && (
                            <Badge
                              variant="outline"
                              className="h-5 rounded-full border-black/10 bg-black/5 px-2 text-[10px] text-black/60"
                            >
                              Você
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-black/70">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full border-black/10 bg-black/5 text-black/70">
                          {ROLE_BADGE[u.role]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage && u.isPending ? (
                          <div className="flex justify-end gap-2">
                            {onResendInvite && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-full"
                                onClick={() => onResendInvite(u)}
                                aria-label={`Reenviar convite para ${u.email}`}
                              >
                                Reenviar
                              </Button>
                            )}
                            {onCancelInvite && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-full text-danger-mid"
                                onClick={() => onCancelInvite(u)}
                                aria-label={`Cancelar convite de ${u.email}`}
                              >
                                Cancelar
                              </Button>
                            )}
                          </div>
                        ) : canManage && !isUltra ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full"
                              onClick={() => openEdit(u)}
                              aria-label={`Editar acessos de ${u.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full text-danger-mid"
                              onClick={() => setDeleteTarget(u)}
                              disabled={u.id === currentUserId}
                              aria-label={`Remover ${u.name}`}
                              title={u.id === currentUserId ? "Você não pode remover a si mesmo" : "Remover"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : isUltra ? (
                          <span className="text-[11px] text-black/40" title="Ultra admin: gerenciado via SQL">
                            Protegido
                          </span>
                        ) : (
                          <span className="text-black/40">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-3 md:hidden">
          {users.length === 0 ? (
            <div className="rounded-lg bg-black/5 p-4 text-sm text-black/50">Nenhum usuário adicionado.</div>
          ) : (
            users.map((u) => {
              const isUltra = u.role === "ultra_admin";
              return (
                <Card key={u.id} className="border border-black/5">
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="line-clamp-1 text-sm font-medium">{u.name}</p>
                          {u.isPending && <Badge variant="secondary">Pendente</Badge>}
                        </div>
                        <p className="mt-1 break-all text-xs text-black/60">{u.email}</p>
                      </div>
                      {canManage && u.isPending ? (
                        <div className="flex flex-col gap-2">
                          {onResendInvite && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full"
                              onClick={() => onResendInvite(u)}
                            >
                              Reenviar
                            </Button>
                          )}
                          {onCancelInvite && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full text-danger-mid"
                              onClick={() => onCancelInvite(u)}
                            >
                              Cancelar
                            </Button>
                          )}
                        </div>
                      ) : (
                        canManage &&
                        !isUltra && (
                          <div className="flex flex-col gap-2">
                            <Button variant="outline" size="sm" className="rounded-full" onClick={() => openEdit(u)}>
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full text-danger-mid"
                              onClick={() => setDeleteTarget(u)}
                              disabled={u.id === currentUserId}
                            >
                              Remover
                            </Button>
                          </div>
                        )
                      )}
                    </div>
                    <Badge variant="outline" className="rounded-full border-black/10 bg-black/5 text-black/70">
                      {ROLE_BADGE[u.role]}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </CardContent>

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        isSubmitting={isInviting}
        onSubmit={async (payload) => {
          try {
            await onInvite(payload);
            setInviteOpen(false); // só fecha em sucesso; no erro o handler lançou e o modal fica aberto
          } catch {
            /* mantém o modal aberto com o formulário preenchido */
          }
        }}
      />

      <EditDialog
        user={editTarget}
        onClose={() => setEditTarget(null)}
        onSubmit={(payload) => {
          onUpdate(payload);
          setEditTarget(null);
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (deleteTarget) onDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
        title="Remover usuário"
        description="Isto revoga o acesso deste usuário. Esta ação não pode ser desfeita."
        itemName={deleteTarget?.name || deleteTarget?.email}
        variant="destructive"
        confirmText="Remover"
      />
    </Card>
  );
}

type InviteDialogProps = {
  open: boolean;
  onClose: () => void;
  isSubmitting: boolean;
  onSubmit: (payload: InvitePayload) => void;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function InviteDialog({ open, onClose, isSubmitting, onSubmit }: InviteDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [role, setRole] = useState<AssignableRole>("user");

  useEffect(() => {
    if (!open) {
      setName("");
      setEmail("");
      setEmailError("");
      setRole("user");
    }
  }, [open]);

  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && !isSubmitting;

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (emailError) setEmailError("");
  };

  const handleEmailBlur = () => {
    const trimmed = email.trim();
    if (trimmed && !EMAIL_REGEX.test(trimmed)) setEmailError("Email inválido");
  };

  const handleSubmit = () => {
    const trimmed = email.trim();
    if (!trimmed || !EMAIL_REGEX.test(trimmed)) {
      setEmailError("Email inválido");
      return;
    }
    onSubmit({ name: name.trim(), email: trimmed, role });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Convidar usuário</DialogTitle>
          <DialogDescription>
            Envie um convite por email. Quem entra acessa os módulos da empresa; o tipo de conta define quem
            administra usuários e plano.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invite-name">
                Nome completo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="invite-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                onBlur={handleEmailBlur}
                placeholder="email@empresa.com"
                aria-invalid={!!emailError}
                className={emailError ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {emailError && <p className="text-xs text-destructive">{emailError}</p>}
            </div>
          </div>

          <RoleSelector value={role} onChange={setRole} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!canSubmit} onClick={handleSubmit} variant="brand">
            {isSubmitting ? "Enviando convite..." : "Enviar convite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type EditDialogProps = {
  user: ManagedUser | null;
  onClose: () => void;
  onSubmit: (payload: UpdatePayload) => void;
};

function EditDialog({ user, onClose, onSubmit }: EditDialogProps) {
  const [role, setRole] = useState<AssignableRole>("user");

  useEffect(() => {
    if (user && user.role !== "ultra_admin") {
      setRole(user.role);
    }
  }, [user]);

  if (!user) return null;

  if (user.role === "ultra_admin") {
    return (
      <Dialog open onOpenChange={(v) => (!v ? onClose() : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-destructive" strokeWidth={1.5} />
              Usuário protegido
            </DialogTitle>
            <DialogDescription>Este usuário só pode ser alterado via SQL no Supabase.</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-black/70">
            <strong>{user.name}</strong> é ultra admin e só pode ser editado via SQL direto no Supabase. Esta proteção
            evita que admins de empresa promovam ou rebaixem ultra admins pela UI.
          </p>
          <DialogFooter>
            <Button onClick={onClose} variant="brand">Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tipo de conta: {user.name}</DialogTitle>
          <DialogDescription>Define quem administra usuários, plano e configuração da empresa.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <RoleSelector value={role} onChange={setRole} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => onSubmit({ id: user.id, role })} variant="brand">
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type RoleSelectorProps = {
  value: AssignableRole;
  onChange: (next: AssignableRole) => void;
};

const ROLE_OPTIONS: readonly {
  value: AssignableRole;
  title: string;
  description: string;
  icon: typeof ShieldCheck;
}[] = [
  {
    value: "user",
    title: "Usuário",
    description: "Usa todos os módulos da empresa",
    icon: UsersIcon,
  },
  {
    value: "admin",
    title: "Admin da empresa",
    description: "Usa tudo e ainda gerencia usuários, plano e configuração",
    icon: ShieldCheck,
  },
];

function RoleSelector({ value, onChange }: RoleSelectorProps) {
  return (
    <div>
      <Label className="text-sm font-medium" id="role-selector-label">
        Tipo de conta
      </Label>
      <div className="mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-labelledby="role-selector-label">
        {ROLE_OPTIONS.map((option) => {
          const active = value === option.value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                active ? "border-brand/40 bg-brand/5" : "border-black/10 hover:border-black/20"
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full",
                  active ? "bg-brand/10" : "bg-black/5"
                )}
              >
                <Icon size={16} strokeWidth={1.5} className={active ? "text-ink" : "text-black/50"} />
              </div>
              <div>
                <div className="text-sm font-medium text-black/80">{option.title}</div>
                <p className="text-xs text-black/50">{option.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Pencil, Trash2, UserPlus, Users as UsersIcon, ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CompanyFeatures, UserFeatures } from "@/lib/features";
import type { PilarRole } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FeatureAccessGrid } from "@/components/admin/FeatureAccessGrid";
import { AccessBadges } from "@/components/admin/AccessBadges";

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: PilarRole;
  isPending?: boolean;
  features: UserFeatures;
};

/** Convite/edição via UI: apenas admin ou user. ultra_admin só por SQL. */
export type AssignableRole = Exclude<PilarRole, "ultra_admin">;

export type InvitePayload = {
  name: string;
  email: string;
  role: AssignableRole;
  features: UserFeatures;
};

export type UpdatePayload = {
  id: string;
  role: AssignableRole;
  features: UserFeatures;
};

export type UsersAccessManagerProps = {
  users: ManagedUser[];
  companyFeatures: CompanyFeatures;
  currentUserId: string | null;
  canManage: boolean;
  isInviting?: boolean;
  onInvite: (payload: InvitePayload) => void;
  onUpdate: (payload: UpdatePayload) => void;
  onDelete: (userId: string) => void;
};

export function UsersAccessManager({
  users,
  companyFeatures,
  currentUserId,
  canManage,
  isInviting = false,
  onInvite,
  onUpdate,
  onDelete,
}: UsersAccessManagerProps) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ManagedUser | null>(null);

  return (
    <Card className="border border-black/5">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon size={20} strokeWidth={1.5} />
            Usuários da Empresa
          </CardTitle>
          <CardDescription>Controle quem acessa cada módulo e com que nível.</CardDescription>
        </div>
        {canManage && (
          <Button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="rounded-full bg-brand text-ink hover:bg-brand/90"
          >
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
                <TableHead>Acessos</TableHead>
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
                        <AccessBadges role={u.role} features={u.features} />
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage && !u.isPending && !isUltra ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full"
                              onClick={() => setEditTarget(u)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full text-red-600"
                              onClick={() => onDelete(u.id)}
                              disabled={u.id === currentUserId}
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
                      {canManage && !u.isPending && !isUltra && (
                        <div className="flex flex-col gap-2">
                          <Button variant="outline" size="sm" className="rounded-full" onClick={() => setEditTarget(u)}>
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full text-red-600"
                            onClick={() => onDelete(u.id)}
                            disabled={u.id === currentUserId}
                          >
                            Remover
                          </Button>
                        </div>
                      )}
                    </div>
                    <AccessBadges role={u.role} features={u.features} />
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
        companyFeatures={companyFeatures}
        isSubmitting={isInviting}
        onSubmit={(payload) => {
          onInvite(payload);
          setInviteOpen(false);
        }}
      />

      <EditDialog
        user={editTarget}
        onClose={() => setEditTarget(null)}
        companyFeatures={companyFeatures}
        onSubmit={(payload) => {
          onUpdate(payload);
          setEditTarget(null);
        }}
      />
    </Card>
  );
}

type InviteDialogProps = {
  open: boolean;
  onClose: () => void;
  companyFeatures: CompanyFeatures;
  isSubmitting: boolean;
  onSubmit: (payload: InvitePayload) => void;
};

function InviteDialog({ open, onClose, companyFeatures, isSubmitting, onSubmit }: InviteDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("user");
  const [features, setFeatures] = useState<UserFeatures>({});

  useEffect(() => {
    if (!open) {
      setName("");
      setEmail("");
      setRole("user");
      setFeatures({});
    }
  }, [open]);

  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && !isSubmitting;
  const isAdmin = role === "admin";

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Convidar usuário</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invite-name">Nome completo</Label>
              <Input
                id="invite-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@empresa.com"
              />
            </div>
          </div>

          <RoleSelector value={role} onChange={setRole} />

          <div>
            <Label className="text-sm font-medium">Acessos</Label>
            <p className="mt-1 text-xs text-black/50">
              {isAdmin
                ? "Admin da empresa tem acesso total — configuração individual desativada."
                : "Defina o nível por módulo. Apenas features ativas na empresa aparecem."}
            </p>
            <div className="mt-3">
              <FeatureAccessGrid
                value={features}
                onChange={setFeatures}
                companyFeatures={companyFeatures}
                disabled={isAdmin}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                email: email.trim(),
                role,
                features: isAdmin ? {} : features,
              })
            }
            className="bg-brand text-ink hover:bg-brand/90"
          >
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
  companyFeatures: CompanyFeatures;
  onSubmit: (payload: UpdatePayload) => void;
};

function EditDialog({ user, onClose, companyFeatures, onSubmit }: EditDialogProps) {
  const [role, setRole] = useState<AssignableRole>("user");
  const [features, setFeatures] = useState<UserFeatures>({});

  useEffect(() => {
    if (user && user.role !== "ultra_admin") {
      setRole(user.role);
      setFeatures(user.features);
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
          </DialogHeader>
          <p className="text-sm text-black/70">
            <strong>{user.name}</strong> é ultra admin e só pode ser editado via SQL direto no Supabase. Esta proteção
            evita que admins de empresa promovam ou rebaixem ultra admins pela UI.
          </p>
          <DialogFooter>
            <Button onClick={onClose}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const isAdmin = role === "admin";

  return (
    <Dialog open onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Editar acessos — {user.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <RoleSelector value={role} onChange={setRole} />

          <FeatureAccessGrid
            value={features}
            onChange={setFeatures}
            companyFeatures={companyFeatures}
            disabled={isAdmin}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => onSubmit({ id: user.id, role, features: isAdmin ? {} : features })}
            className="bg-brand text-ink hover:bg-brand/90"
          >
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
    description: "Acesso granular por feature (viewer ou editor)",
    icon: UsersIcon,
  },
  {
    value: "admin",
    title: "Admin da empresa",
    description: "Gerencia usuários, features e plano. Bypass em tudo da empresa.",
    icon: ShieldCheck,
  },
];

function RoleSelector({ value, onChange }: RoleSelectorProps) {
  return (
    <div>
      <Label className="text-sm font-medium">Tipo de conta</Label>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {ROLE_OPTIONS.map((option) => {
          const active = value === option.value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
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
                <Icon size={16} strokeWidth={1.5} className={active ? "text-brand" : "text-black/50"} />
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

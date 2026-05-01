import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Users as UsersIcon } from "lucide-react";
import type { CompanyUser } from "../types";
import { ROLES } from "../types";

interface CompanyUsersTabProps {
  users: CompanyUser[];
  isAdmin: boolean;
  currentUserId: string | null;
  inviteFirstName: string;
  inviteLastName: string;
  inviteEmail: string;
  inviteRole: (typeof ROLES)[number];
  isInviting: boolean;
  onInviteFirstNameChange: (v: string) => void;
  onInviteLastNameChange: (v: string) => void;
  onInviteEmailChange: (v: string) => void;
  onInviteRoleChange: (v: (typeof ROLES)[number]) => void;
  onAddUser: () => void;
  onEditUser: (u: CompanyUser) => void;
  onDeleteUser: (id: string) => void;
}

export function CompanyUsersTab({
  users,
  isAdmin,
  currentUserId,
  inviteFirstName,
  inviteLastName,
  inviteEmail,
  inviteRole,
  isInviting,
  onInviteFirstNameChange,
  onInviteLastNameChange,
  onInviteEmailChange,
  onInviteRoleChange,
  onAddUser,
  onEditUser,
  onDeleteUser,
}: CompanyUsersTabProps) {
  return (
    <Card className="border border-black/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UsersIcon size={20} />
          Usuários da Empresa
        </CardTitle>
        <CardDescription>Gerencie os usuários com acesso ao sistema</CardDescription>
      </CardHeader>
      <CardContent>
        {isAdmin && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invite-first-name">Nome</Label>
                <Input
                  id="invite-first-name"
                  value={inviteFirstName}
                  onChange={(e) => onInviteFirstNameChange(e.target.value)}
                  placeholder="Nome"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-last-name">Sobrenome</Label>
                <Input
                  id="invite-last-name"
                  value={inviteLastName}
                  onChange={(e) => onInviteLastNameChange(e.target.value)}
                  placeholder="Sobrenome"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => onInviteEmailChange(e.target.value)}
                  placeholder="email@empresa.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Função</Label>
                <Select value={inviteRole} onValueChange={(v) => onInviteRoleChange(v as (typeof ROLES)[number])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Button
                onClick={onAddUser}
                className="rounded-full bg-brand hover:bg-brand/90 text-ink"
                disabled={isInviting || !inviteFirstName.trim() || !inviteEmail.trim()}
              >
                {isInviting ? "Enviando convite..." : "Adicionar Usuário"}
              </Button>
              <p className="text-xs text-black/50">
                O convite será enviado por email e o usuário aparecerá como pendente.
              </p>
            </div>
          </div>
        )}

        {/* Desktop table */}
        <div className="hidden md:block mt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Função</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-black/50">
                    Nenhum usuário adicionado
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id} className={u.id.startsWith("pending-") ? "opacity-80" : ""}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span className="line-clamp-1">{u.name}</span>
                        {u.id.startsWith("pending-") && <Badge variant="secondary">Pendente</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-black/70">{u.email}</TableCell>
                    <TableCell className="text-black/70">{u.role || "-"}</TableCell>
                    <TableCell className="text-right">
                      {isAdmin && !u.id.startsWith("pending-") ? (
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" className="rounded-full" onClick={() => onEditUser(u)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full text-red-600"
                            onClick={() => onDeleteUser(u.id)}
                            disabled={u.id === currentUserId}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-black/40">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden mt-6 space-y-3">
          {users.length === 0 ? (
            <div className="text-sm text-black/50 bg-black/5 rounded-lg p-4">Nenhum usuário adicionado</div>
          ) : (
            users.map((u) => (
              <Card key={u.id} className="border border-black/5">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium line-clamp-1">{u.name}</p>
                        {u.id.startsWith("pending-") && <Badge variant="secondary">Pendente</Badge>}
                      </div>
                      <p className="text-xs text-black/60 break-all mt-1">{u.email}</p>
                      <p className="text-xs text-black/60 mt-1">{u.role || "-"}</p>
                    </div>
                    {isAdmin && !u.id.startsWith("pending-") ? (
                      <div className="flex flex-col gap-2">
                        <Button variant="outline" size="sm" className="rounded-full" onClick={() => onEditUser(u)}>
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full text-red-600"
                          onClick={() => onDeleteUser(u.id)}
                          disabled={u.id === currentUserId}
                        >
                          Remover
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

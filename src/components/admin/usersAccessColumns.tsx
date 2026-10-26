import { Pencil, Target, Trash2, Users as UsersIcon, Wallet } from "lucide-react";
import type { ColumnDef } from "@/components/data/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PilarRole } from "@/lib/roles";
import type { ManagedUser } from "./UsersAccessManager";

interface UsersColumnsContext {
  canManage: boolean;
  currentUserId?: string | null;
  showLastAccess: boolean;
  roleBadge: Record<PilarRole, string>;
  ultimoAcesso: (u: ManagedUser) => string;
  onResendInvite?: (u: ManagedUser) => void;
  onCancelInvite?: (u: ManagedUser) => void;
  onEdit: (u: ManagedUser) => void;
  onDelete: (u: ManagedUser) => void;
}

/**
 * Colunas da tabela de usuários (SPEC 127). Saiu do `UsersAccessManager` para o arquivo
 * ficar abaixo do teto de tamanho; a linha de convite pendente esmaece por `rowClassName`.
 */
export function buildUsersColumns({
  canManage,
  currentUserId,
  showLastAccess,
  roleBadge,
  ultimoAcesso,
  onResendInvite,
  onCancelInvite,
  onEdit,
  onDelete,
}: UsersColumnsContext): ColumnDef<ManagedUser>[] {
  return [
    {
      key: "nome",
      header: "Nome",
      className: "font-medium",
      cell: (u) => (
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
      ),
    },
    { key: "email", header: "Email", className: "text-black/70", cell: (u) => u.email },
    {
      key: "tipo",
      header: "Tipo de conta",
      cell: (u) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="rounded-full border-black/10 bg-black/5 text-black/70">
            {roleBadge[u.role]}
          </Badge>
          {u.role === "coordenador" && u.financeiroDelegado && (
            <Badge variant="outline" className="rounded-full border-brand/20 bg-brand/10 text-ink gap-1">
              <Wallet size={11} strokeWidth={1.75} />
              Financeiro
            </Badge>
          )}
          {u.role === "coordenador" && u.equipeDelegado && (
            <Badge variant="outline" className="rounded-full border-brand/20 bg-brand/10 text-ink gap-1">
              <UsersIcon size={11} strokeWidth={1.75} />
              Equipe
            </Badge>
          )}
          {u.role === "coordenador" && u.metasDelegado && (
            <Badge variant="outline" className="rounded-full border-brand/20 bg-brand/10 text-ink gap-1">
              <Target size={11} strokeWidth={1.75} />
              Metas
            </Badge>
          )}
        </div>
      ),
    },
    ...(showLastAccess
      ? [
          {
            key: "ultimo-acesso",
            header: "Último acesso",
            className: "text-black/60",
            cell: (u: ManagedUser) => ultimoAcesso(u),
          },
        ]
      : []),
    {
      key: "acoes",
      header: "Ações",
      align: "end",
      className: "w-32",
      cell: (u) => {
        const isUltra = u.role === "ultra_admin";
        if (canManage && u.isPending) {
          return (
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
          );
        }
        if (canManage && !isUltra) {
          return (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => onEdit(u)}
                aria-label={`Editar acessos de ${u.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full text-danger-mid"
                onClick={() => onDelete(u)}
                disabled={u.id === currentUserId}
                aria-label={`Remover ${u.name}`}
                title={u.id === currentUserId ? "Você não pode remover a si mesmo" : "Remover"}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        }
        if (isUltra) {
          return (
            <span className="text-[11px] text-muted-foreground" title="Ultra admin: gerenciado via SQL">
              Protegido
            </span>
          );
        }
        return <span className="text-black/40">-</span>;
      },
    },
  ];
}

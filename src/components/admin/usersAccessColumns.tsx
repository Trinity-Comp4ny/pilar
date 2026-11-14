import { RowActions } from "@/components/data/RowActions";
import { Pencil, Target, Trash2, Users as UsersIcon, Wallet } from "lucide-react";
import type { ColumnDef } from "@/components/data/DataTable";
import { Badge } from "@/components/ui/badge";
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
              className="h-5 rounded-full border-black/10 bg-black/5 px-2 text-3xs text-black/60"
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
      header: <span className="sr-only">Ações</span>,
      align: "end",
      cell: (u) => {
        const isUltra = u.role === "ultra_admin";
        if (canManage && u.isPending) {
          return (
            <RowActions
              label={u.email}
              actions={[
                ...(onResendInvite ? [{ label: "Reenviar convite", onClick: () => onResendInvite(u) }] : []),
                ...(onCancelInvite
                  ? [{ label: "Cancelar convite", destructive: true, onClick: () => onCancelInvite(u) }]
                  : []),
              ]}
            />
          );
        }
        if (canManage && !isUltra) {
          return (
            <RowActions
              label={u.name}
              actions={[
                { label: "Editar acessos", icon: Pencil, onClick: () => onEdit(u) },
                {
                  label: "Remover",
                  icon: Trash2,
                  destructive: true,
                  disabled: u.id === currentUserId,
                  onClick: () => onDelete(u),
                },
              ]}
            />
          );
        }
        if (isUltra) {
          return (
            <span className="text-2xs text-muted-foreground" title="Ultra admin: gerenciado via SQL">
              Protegido
            </span>
          );
        }
        return <span className="text-black/40">-</span>;
      },
    },
  ];
}

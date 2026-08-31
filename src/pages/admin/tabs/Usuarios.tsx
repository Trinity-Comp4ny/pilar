import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callUntypedRpc } from "@/lib/supabaseRpc";
import { toast } from "sonner";
import { reportInvokeError } from "@/lib/monitoring";
import { getSafeErrorMessage } from "@/lib/safeError";
import { UsersAccessManager, type ManagedUser } from "@/components/admin/UsersAccessManager";
import { useRequireAal2 } from "@/hooks/useRequireAal2";
import type { PilarRole } from "@/lib/roles";

type RawUser = {
  id: string;
  nome: string;
  email: string;
  role: string | null;
  financeiroDelegado?: boolean;
  isPending?: boolean;
  inviteId?: string | null;
};

type Props = {
  users: RawUser[];
  setUsers: (updater: (prev: RawUser[]) => RawUser[]) => void;
  currentUserId: string | null;
};

function normalizeRole(role: string | null | undefined): PilarRole {
  if (role === "ultra_admin") return "ultra_admin";
  if (role === "admin") return "admin";
  if (role === "coordenador") return "coordenador";
  return "user";
}

export function UsuariosTab({ users, setUsers, currentUserId }: Props) {
  const requireAal2 = useRequireAal2();
  const [isInviting, setIsInviting] = useState(false);

  const managed = useMemo<ManagedUser[]>(
    () =>
      users.map((u) => ({
        id: u.id,
        name: u.nome,
        email: u.email,
        role: normalizeRole(u.role),
        financeiroDelegado: u.financeiroDelegado ?? false,
        isPending: u.isPending ?? u.id.startsWith("pending-"),
        inviteId: u.inviteId,
      })),
    [users]
  );

  const handleInvite = async (payload: { name: string; email: string; role: "admin" | "coordenador" | "user" }) => {
    if (!(await requireAal2())) return;
    setIsInviting(true);
    try {
      const { error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: payload.email,
          nome: payload.name,
          role: payload.role,
        },
      });
      if (error) throw error;

      toast.success("Convite enviado", { description: `Email enviado para ${payload.email}` });
      setUsers((prev) => [
        ...prev,
        {
          id: `pending-${Date.now()}`,
          nome: payload.name,
          email: payload.email,
          role: payload.role,
          isPending: true,
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
      reportInvokeError(err, "invite-user:convidar");
      toast.error("Erro ao convidar", { description: msg });
      throw err; // mantém o modal aberto com o formulário preenchido
    } finally {
      setIsInviting(false);
    }
  };

  const handleResendInvite = async (u: ManagedUser) => {
    if (!u.inviteId) {
      toast.error("Recarregue a página para reenviar este convite");
      return;
    }
    try {
      const { error } = await supabase.functions.invoke("invite-user", {
        body: { action: "resend", convite_id: u.inviteId },
      });
      if (error) throw error;
      toast.success("Convite reenviado", { description: `Novo e-mail enviado para ${u.email}` });
    } catch (err) {
      reportInvokeError(err, "invite-user:resend");
      toast.error("Não foi possível reenviar o convite", {
        description: getSafeErrorMessage(err, "Tente de novo em instantes."),
      });
    }
  };

  const handleCancelInvite = async (u: ManagedUser) => {
    if (!u.inviteId) {
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      return;
    }
    try {
      const { error } = await supabase.functions.invoke("invite-user", {
        method: "DELETE",
        body: { convite_id: u.inviteId },
      });
      if (error) throw error;
      setUsers((prev) => prev.filter((x) => x.inviteId !== u.inviteId));
      toast.success("Convite cancelado");
    } catch (err) {
      reportInvokeError(err, "invite-user:cancel");
      toast.error("Não foi possível cancelar o convite", {
        description: getSafeErrorMessage(err, "Tente de novo em instantes."),
      });
    }
  };

  const handleUpdate = async (payload: { id: string; role: "admin" | "coordenador" | "user" }) => {
    if (!(await requireAal2())) return;
    try {
      // gen:types ainda não inclui update_user_access
      const { error } = await callUntypedRpc("update_user_access", {
        p_user_id: payload.id,
        p_role: payload.role,
      });
      if (error) throw error;

      setUsers((prev) => prev.map((u) => (u.id === payload.id ? { ...u, role: payload.role } : u)));
      toast.success("Tipo de conta atualizado");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
      reportInvokeError(err, "ultra-admin-usuarios:salvar-acessos");
      toast.error("Erro ao salvar", { description: msg });
    }
  };

  // ADR 0034: acesso financeiro é concedido/revogado por pessoa, sempre pela
  // RPC (nunca UPDATE direto — a coluna tem UPDATE revogado de authenticated).
  const handleSetFinanceiroDelegado = async (userId: string, delegado: boolean) => {
    if (!(await requireAal2())) return;
    try {
      // gen:types ainda não inclui set_financeiro_delegado
      const { error } = await callUntypedRpc("set_financeiro_delegado", {
        p_user_id: userId,
        p_delegado: delegado,
      });
      if (error) throw error;

      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, financeiroDelegado: delegado } : u)));
      toast.success(delegado ? "Acesso financeiro concedido" : "Acesso financeiro revogado");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
      reportInvokeError(err, "set_financeiro_delegado");
      toast.error("Erro ao salvar", { description: msg });
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await requireAal2())) return;
    try {
      const { error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: id },
      });
      if (error) throw error;
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success("Usuário removido");
    } catch (err) {
      reportInvokeError(err, "delete-user");
      toast.error("Erro ao remover usuário");
    }
  };

  return (
    <UsersAccessManager
      users={managed}
      currentUserId={currentUserId}
      canManage
      isInviting={isInviting}
      onRequireAuth={requireAal2}
      onInvite={handleInvite}
      onUpdate={handleUpdate}
      onSetFinanceiroDelegado={handleSetFinanceiroDelegado}
      onDelete={handleDelete}
      onResendInvite={handleResendInvite}
      onCancelInvite={handleCancelInvite}
    />
  );
}

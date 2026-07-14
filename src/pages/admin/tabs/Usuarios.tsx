import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callUntypedRpc } from "@/lib/supabaseRpc";
import { toast } from "sonner";
import { UsersAccessManager, type ManagedUser } from "@/components/admin/UsersAccessManager";
import { useRequireAal2 } from "@/hooks/useRequireAal2";
import { parseUserFeatures, type CompanyFeatures, type UserFeatures } from "@/lib/features";
import type { PilarRole } from "@/lib/roles";

type RawUser = {
  id: string;
  nome: string;
  email: string;
  role: string | null;
  features?: unknown;
  isPending?: boolean;
  inviteId?: string | null;
};

type Props = {
  users: RawUser[];
  setUsers: (updater: (prev: RawUser[]) => RawUser[]) => void;
  currentUserId: string | null;
  companyFeatures: CompanyFeatures;
};

function normalizeRole(role: string | null | undefined): PilarRole {
  if (role === "ultra_admin") return "ultra_admin";
  if (role === "admin") return "admin";
  return "user";
}

export function UsuariosTab({ users, setUsers, currentUserId, companyFeatures }: Props) {
  const requireAal2 = useRequireAal2();
  const [isInviting, setIsInviting] = useState(false);

  const managed = useMemo<ManagedUser[]>(
    () =>
      users.map((u) => ({
        id: u.id,
        name: u.nome,
        email: u.email,
        role: normalizeRole(u.role),
        features: parseUserFeatures(u.features),
        isPending: u.isPending ?? u.id.startsWith("pending-"),
        inviteId: u.inviteId,
      })),
    [users]
  );

  const handleInvite = async (payload: {
    name: string;
    email: string;
    role: "admin" | "user";
    features: UserFeatures;
  }) => {
    if (!(await requireAal2())) return;
    setIsInviting(true);
    try {
      const { error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: payload.email,
          nome: payload.name,
          role: payload.role,
          features: payload.features,
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
          features: payload.features,
          isPending: true,
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
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
      toast.error("Erro ao reenviar", { description: err instanceof Error ? err.message : "Erro inesperado" });
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
      toast.error("Erro ao cancelar", { description: err instanceof Error ? err.message : "Erro inesperado" });
    }
  };

  const handleUpdate = async (payload: { id: string; role: "admin" | "user"; features: UserFeatures }) => {
    if (!(await requireAal2())) return;
    try {
      // gen:types ainda não inclui update_user_access
      const { error } = await callUntypedRpc("update_user_access", {
        p_user_id: payload.id,
        p_role: payload.role,
        p_features: payload.features,
      });
      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.id === payload.id ? { ...u, role: payload.role, features: payload.features } : u))
      );
      toast.success("Acessos atualizados");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
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
    } catch {
      toast.error("Erro ao remover usuário");
    }
  };

  return (
    <UsersAccessManager
      users={managed}
      companyFeatures={companyFeatures}
      currentUserId={currentUserId}
      canManage
      isInviting={isInviting}
      onRequireAuth={requireAal2}
      onInvite={handleInvite}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
      onResendInvite={handleResendInvite}
      onCancelInvite={handleCancelInvite}
    />
  );
}

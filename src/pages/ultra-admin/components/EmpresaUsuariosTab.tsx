import { UsersAccessManager, type ManagedUser } from "@/components/admin/UsersAccessManager";
import { callUntypedRpc } from "@/lib/supabaseRpc";
import { edgeFetch, type EmpresaDetalhe as Empresa } from "../api";
import { useAcaoEmpresa } from "../hooks";

export function EmpresaUsuariosTab({ empresa }: { empresa: Empresa }) {
  const base = { erro: "Não foi possível salvar", contexto: "ultra-admin-usuarios" };
  const convidar = useAcaoEmpresa({
    ...base,
    run: (p: { firstName: string; lastName: string; email: string; role: string }) =>
      edgeFetch("ultra-admin-usuarios", {
        body: {
          empresa_id: empresa.id,
          email: p.email,
          nome: [p.firstName, p.lastName].filter(Boolean).join(" "),
          role: p.role,
        },
      }),
    sucesso: "Convite enviado",
  });
  const mudarPapel = useAcaoEmpresa({
    ...base,
    run: (p: { id: string; role: string }) =>
      edgeFetch("ultra-admin-usuarios", {
        method: "PUT",
        body: { user_id: p.id, role: p.role, empresa_id: empresa.id },
      }),
    sucesso: "Acesso atualizado",
  });
  const remover = useAcaoEmpresa({
    ...base,
    run: (userId: string) =>
      edgeFetch("ultra-admin-usuarios", { method: "DELETE", body: { user_id: userId, empresa_id: empresa.id } }),
    sucesso: "Usuário removido",
  });
  const reenviar = useAcaoEmpresa({
    ...base,
    run: (u: ManagedUser) =>
      edgeFetch("ultra-admin-usuarios", { method: "POST", body: { resend: true, convite_id: u.inviteId } }),
    sucesso: (u) => `Convite reenviado para ${u.email}`,
  });
  const cancelarConvite = useAcaoEmpresa({
    ...base,
    run: (u: ManagedUser) =>
      edgeFetch("ultra-admin-usuarios", {
        method: "DELETE",
        body: { convite_id: u.inviteId, empresa_id: empresa.id },
      }),
    sucesso: "Convite cancelado",
  });
  // As RPCs set_*_delegado se autorizam pra ultra_admin dentro da função
  // (SECURITY DEFINER): chamada direta, sem passar pela edge.
  const delegar = useAcaoEmpresa({
    ...base,
    run: async (p: { rpc: string; userId: string; delegado: boolean }) => {
      const { error } = await callUntypedRpc(p.rpc, { p_user_id: p.userId, p_delegado: p.delegado });
      if (error) throw error;
    },
    sucesso: (p) => (p.delegado ? "Acesso concedido" : "Acesso revogado"),
  });

  return (
    <UsersAccessManager
      title="Usuários"
      description="Quem tem login nesta empresa, o papel de cada um e quando entrou pela última vez."
      showLastAccess
      users={empresa.usuarios}
      currentUserId={null}
      canManage
      isInviting={convidar.isPending}
      onInvite={(p) => convidar.mutateAsync(p).then(() => undefined)}
      onUpdate={(p) => mudarPapel.mutate(p)}
      onDelete={(userId) => remover.mutate(userId)}
      onResendInvite={(u) => reenviar.mutate(u)}
      onCancelInvite={(u) => cancelarConvite.mutate(u)}
      onSetFinanceiroDelegado={(userId, d) => delegar.mutate({ rpc: "set_financeiro_delegado", userId, delegado: d })}
      onSetEquipeDelegado={(userId, d) => delegar.mutate({ rpc: "set_equipe_delegado", userId, delegado: d })}
      onSetMetasDelegado={(userId, d) => delegar.mutate({ rpc: "set_metas_delegado", userId, delegado: d })}
    />
  );
}

import { Navigate, Outlet } from "react-router-dom";
import { useRole } from "@/hooks/useRole";
import { dashboardForRole, isContractRole, type ContractRole } from "@/lib/rbac";

type Props = {
  /** Papéis do contrato que PODEM ver a rota. */
  roles: ContractRole[];
  /** Filhos opcionais; se ausente, renderiza <Outlet /> (uso como layout route). */
  children?: React.ReactNode;
};

/**
 * Guard de papel na camada de UI. Redireciona para a "casa" do próprio papel
 * (não joga 403 na cara) quando o papel não está na lista permitida.
 *
 * Transição: só bloqueia papéis RECONHECIDOS do contrato
 * ("owner" | "coordenador" | "colaborador"). Papéis legados
 * ("user" | "admin" | "ultra_admin"), enquanto a migration do Cluster 1 não
 * roda, passam direto — o acesso deles segue regido pelo FeatureRoute e pela
 * RLS. Isso mantém o guard aditivo e evita derrubar quem já usa a plataforma.
 *
 * IMPORTANTE: a segurança de verdade é a RLS do backend (Cluster 1). Este
 * componente é UX: evita mostrar telas que o backend recusaria de qualquer forma.
 */
export function RequireRole({ roles, children }: Props) {
  const role = useRole();

  if (isContractRole(role) && !roles.includes(role)) {
    return <Navigate to={dashboardForRole(role)} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

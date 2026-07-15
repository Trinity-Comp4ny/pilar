/**
 * Contrato de papéis de RBAC — compartilhado com o Cluster 1 (RLS/migration).
 *
 * A segurança REAL vive na RLS do backend. Este módulo é só a camada de UX:
 * decide o que esconder/redirecionar no cliente. Um usuário que force a URL
 * ainda esbarra na RLS; aqui só evitamos mostrar telas às quais ele não tem
 * acesso.
 *
 * Nomes EXATOS do contrato: "owner" | "coordenador" | "colaborador".
 *
 * Nota de transição: o enum `user_role` do banco hoje é
 * "user" | "admin" | "ultra_admin". A migration do Cluster 1 introduz os
 * papéis do contrato. Enquanto ela não roda, papéis legados NÃO são
 * bloqueados por este guard (ver RequireRole) — o acesso deles continua
 * regido pelo FeatureRoute/permissões existente.
 */

export const CONTRACT_ROLES = ["owner", "coordenador", "colaborador"] as const;

export type ContractRole = (typeof CONTRACT_ROLES)[number];

/** True quando a string é um dos papéis do contrato de RBAC. */
export function isContractRole(role: string | null | undefined): role is ContractRole {
  return role != null && (CONTRACT_ROLES as readonly string[]).includes(role);
}

/**
 * Mapa único papel → rota "casa". Fonte da verdade para onde mandar cada
 * papel quando ele cai numa rota que não lhe pertence.
 *
 * Hoje o Pilar tem um único dashboard interno (`/dashboard`) para todos os
 * papéis do contrato; o destino difere só para não-autenticado. Manter o
 * mapa explícito deixa trivial diferenciar destinos por papel no futuro
 * (ex.: um painel só de coordenação) sem caçar redirects espalhados.
 */
const ROLE_DASHBOARD: Record<ContractRole, string> = {
  owner: "/dashboard",
  coordenador: "/dashboard",
  colaborador: "/dashboard",
};

/** Rota "casa" do papel. Sem papel (deslogado) → tela de login. */
export function dashboardForRole(role: string | null | undefined): string {
  if (isContractRole(role)) return ROLE_DASHBOARD[role];
  return role ? "/dashboard" : "/login";
}

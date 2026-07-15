import { useAuth } from "@/contexts/AuthContext";

/**
 * Seletor mínimo e aditivo do papel do usuário logado.
 *
 * Lê direto do AuthContext (profile.role) sem alterá-lo. Retorna a string do
 * papel como está no banco — pode ser um papel do contrato de RBAC
 * ("owner" | "coordenador" | "colaborador") ou um papel legado
 * ("user" | "admin" | "ultra_admin") durante a transição. Quem consome
 * (ex.: RequireRole) decide como interpretar via isContractRole.
 */
export function useRole(): string | null {
  const { profile } = useAuth();
  return profile?.role ?? null;
}

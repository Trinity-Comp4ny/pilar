import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Monta idle timeout conforme role:
 * - Admin: 15 min (dados sensíveis)
 * - Operacional/financeiro: 30 min
 * - User: 60 min
 */
export function IdleTimeoutProvider() {
  const { profile } = useAuth();

  const timeoutMs = (() => {
    if (!profile) return 30 * 60 * 1000;
    if (profile.role === "admin" || profile.role === "ultra_admin") return 15 * 60 * 1000;
    return 60 * 60 * 1000;
  })();

  useIdleTimeout({ timeoutMs });
  return null;
}

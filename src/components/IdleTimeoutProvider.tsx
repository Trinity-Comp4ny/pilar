import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Monta idle timeout conforme role:
 * - Admin/ultra_admin: 15 min (dados sensíveis)
 * - User: 2h
 */
export function IdleTimeoutProvider() {
  const { profile } = useAuth();

  const timeoutMs = (() => {
    if (!profile) return 30 * 60 * 1000;
    if (profile.role === "admin" || profile.role === "ultra_admin") return 15 * 60 * 1000;
    return 2 * 60 * 60 * 1000;
  })();

  useIdleTimeout({ timeoutMs });
  return null;
}

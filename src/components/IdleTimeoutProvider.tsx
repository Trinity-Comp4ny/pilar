import { useState } from "react";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { useAuth } from "@/contexts/AuthContext";
import { STORAGE_KEYS } from "@/constants";

/**
 * Monta idle timeout conforme role:
 * - Admin/ultra_admin: 15 min (dados sensíveis)
 * - User: 2h
 * Se "Lembrar-me" estiver ativo, desabilita o idle timeout.
 */
export function IdleTimeoutProvider() {
  const { profile } = useAuth();

  const [rememberMe] = useState(() => localStorage.getItem(STORAGE_KEYS.REMEMBER_ME) === "1");

  const timeoutMs = (() => {
    if (!profile) return 30 * 60 * 1000;
    if (profile.role === "admin" || profile.role === "ultra_admin") return 15 * 60 * 1000;
    return 2 * 60 * 60 * 1000;
  })();

  useIdleTimeout({ timeoutMs, enabled: !rememberMe });
  return null;
}

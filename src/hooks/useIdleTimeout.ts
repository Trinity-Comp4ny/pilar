import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 min
const WARNING_MS = 60 * 1000; // 1 min antes
const EVENTS = ["mousedown", "keydown", "touchstart", "scroll", "visibilitychange"];

interface Options {
  timeoutMs?: number;
  enabled?: boolean;
}

/**
 * Desloga automaticamente após inatividade. Avisa 1 min antes via toast.
 *
 * Default: 30 min. Admin idealmente 10 min (passar timeoutMs via opção).
 */
export function useIdleTimeout({ timeoutMs = DEFAULT_TIMEOUT_MS, enabled = true }: Options = {}) {
  const { signOut, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const lastActivity = useRef(Date.now());
  const warningShown = useRef(false);

  useEffect(() => {
    if (!enabled || !isAuthenticated) return;

    const reset = () => {
      lastActivity.current = Date.now();
      warningShown.current = false;
    };

    const onEvent = () => reset();
    EVENTS.forEach((e) => window.addEventListener(e, onEvent, { passive: true }));

    const interval = setInterval(async () => {
      const elapsed = Date.now() - lastActivity.current;

      if (elapsed >= timeoutMs) {
        await signOut();
        toast.info("Sessão expirada por inatividade");
        navigate("/", { replace: true });
        return;
      }

      if (!warningShown.current && elapsed >= timeoutMs - WARNING_MS) {
        warningShown.current = true;
        toast.warning("Sessão expirará em 1 minuto", {
          description: "Interaja com a página pra manter a sessão ativa.",
          duration: 30000,
        });
      }
    }, 5000);

    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, onEvent));
      clearInterval(interval);
    };
  }, [timeoutMs, enabled, isAuthenticated, signOut, navigate]);
}

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { monitoring } from "@/lib/monitoring";
import { supabase } from "@/integrations/supabase/client";
import type { UserRole } from "@/lib/permissions";

const STORAGE_KEY = "pilar-view-as-role";

interface ImpersonationContextValue {
  viewAsRole: UserRole | null;
  isImpersonating: boolean;
  loading: boolean;
  /**
   * Inicia impersonation. Falha se o servidor rejeitar (não-admin, target inválido, etc).
   * Lança erro em caso de falha — o caller pode mostrar toast.
   */
  startImpersonation: (role: UserRole) => Promise<void>;
  stopImpersonation: () => Promise<void>;
}

export const ImpersonationContext = createContext<ImpersonationContextValue | null>(null);

export function useImpersonation(): ImpersonationContextValue {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error("useImpersonation must be used within ImpersonationProvider");
  return ctx;
}

const VALID_ROLES: UserRole[] = ["admin", "ultra_admin", "user"];

function writeStored(role: UserRole | null) {
  try {
    if (role) localStorage.setItem(STORAGE_KEY, role);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

interface ImpersonationSession {
  target_role: string | null;
}

async function fetchServerSession(): Promise<ImpersonationSession | null> {
  // RPC `current_impersonation` retorna row da tabela impersonation_sessions ou NULL.
  // Cast defensivo: tipos podem estar desatualizados (rodar `npm run gen:types` para sincronizar).
  type RpcCaller = (name: string) => Promise<{ data: unknown; error: unknown }>;
  const rpcCall = supabase.rpc as unknown as RpcCaller;
  const { data, error } = await rpcCall("current_impersonation");
  if (error) return null;
  const row = (Array.isArray(data) ? data[0] : data) as ImpersonationSession | null;
  return row?.target_role ? row : null;
}

async function callImpersonationFn(action: "start" | "stop", viewAsRole: string): Promise<void> {
  const { error } = await supabase.functions.invoke("log-impersonation", {
    body: { action, viewAsRole },
  });
  if (error) throw new Error(error.message ?? "Falha ao registrar impersonation");
}

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const realRole = (profile?.role ?? null) as UserRole | null;
  const [viewAsRole, setViewAsRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  // Source of truth: servidor. Hidrata estado no mount + sempre que role real mudar.
  useEffect(() => {
    let cancelled = false;

    const isAdmin = realRole === "admin" || realRole === "ultra_admin";

    if (!isAdmin) {
      setViewAsRole(null);
      writeStored(null);
      setLoading(false);
      return;
    }

    (async () => {
      const session = await fetchServerSession();
      if (cancelled) return;

      if (session?.target_role && (VALID_ROLES as string[]).includes(session.target_role)) {
        const role = session.target_role as UserRole;
        setViewAsRole(role);
        writeStored(role);
      } else {
        // Sem sessão ativa no servidor → limpa localStorage stale (segurança).
        setViewAsRole(null);
        writeStored(null);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [realRole]);

  const startImpersonation = useCallback(
    async (role: UserRole) => {
      if (realRole !== "admin" && realRole !== "ultra_admin") {
        throw new Error("Apenas admin pode iniciar impersonation");
      }
      if (role === "admin" || role === "ultra_admin") {
        throw new Error("Impersonation de admin não permitido");
      }

      // Optimistic update
      const prev = viewAsRole;
      setViewAsRole(role);
      writeStored(role);

      try {
        await callImpersonationFn("start", role);
        monitoring.captureMessage("impersonation_start", "warning", { role });
      } catch (err) {
        // Rollback — servidor rejeitou
        setViewAsRole(prev);
        writeStored(prev);
        monitoring.captureException(err, { source: "impersonation.start", role });
        throw err;
      }
    },
    [realRole, viewAsRole]
  );

  const stopImpersonation = useCallback(async () => {
    const prev = viewAsRole;
    setViewAsRole(null);
    writeStored(null);

    if (!prev) return;

    try {
      await callImpersonationFn("stop", prev);
      monitoring.captureMessage("impersonation_stop", "info");
    } catch (err) {
      // Reverter UI — servidor não conseguiu encerrar (sessão pode estar zumbi).
      // Estratégia conservadora: deixar UI sem impersonation; servidor expira em 30min.
      monitoring.captureException(err, { source: "impersonation.stop" });
    }
  }, [viewAsRole]);

  const value: ImpersonationContextValue = {
    viewAsRole,
    isImpersonating: viewAsRole !== null && (realRole === "admin" || realRole === "ultra_admin"),
    loading,
    startImpersonation,
    stopImpersonation,
  };

  return <ImpersonationContext.Provider value={value}>{children}</ImpersonationContext.Provider>;
}

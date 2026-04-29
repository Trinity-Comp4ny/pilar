import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { monitoring } from "@/lib/monitoring";
import { supabase } from "@/integrations/supabase/client";
import type { UserRole } from "@/lib/permissions";

const STORAGE_KEY = "pilar-view-as-role";

interface ImpersonationContextValue {
  viewAsRole: UserRole | null;
  isImpersonating: boolean;
  startImpersonation: (role: UserRole) => void;
  stopImpersonation: () => void;
}

export const ImpersonationContext = createContext<ImpersonationContextValue | null>(null);

export function useImpersonation(): ImpersonationContextValue {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error("useImpersonation must be used within ImpersonationProvider");
  return ctx;
}

function readStored(): UserRole | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const valid: UserRole[] = ["admin", "ultra_admin", "user"];
    return (valid as string[]).includes(raw) ? (raw as UserRole) : null;
  } catch {
    return null;
  }
}

async function auditImpersonation(action: "start" | "stop", viewAsRole: string): Promise<void> {
  try {
    await supabase.functions.invoke("log-impersonation", {
      body: { action, viewAsRole },
    });
  } catch {
    // Falha de auditoria não deve bloquear a UI
  }
}

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const realRole = (profile?.role ?? null) as UserRole | null;
  const [viewAsRole, setViewAsRole] = useState<UserRole | null>(null);

  useEffect(() => {
    if (realRole !== "admin" && realRole !== ("ultra_admin" as UserRole)) {
      setViewAsRole(null);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* noop */
      }
      return;
    }
    setViewAsRole(readStored());
  }, [realRole]);

  const startImpersonation = useCallback(
    (role: UserRole) => {
      if (realRole !== "admin" && realRole !== ("ultra_admin" as UserRole)) return;
      if (role === "admin" || role === ("ultra_admin" as UserRole)) return;
      setViewAsRole(role);
      try {
        localStorage.setItem(STORAGE_KEY, role);
      } catch {
        /* noop */
      }
      monitoring.captureMessage("impersonation_start", "warning", { role });
      auditImpersonation("start", role);
    },
    [realRole]
  );

  const stopImpersonation = useCallback(() => {
    const prev = viewAsRole;
    setViewAsRole(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    monitoring.captureMessage("impersonation_stop", "info");
    if (prev) auditImpersonation("stop", prev);
  }, [viewAsRole]);

  const value: ImpersonationContextValue = {
    viewAsRole,
    isImpersonating: viewAsRole !== null && (realRole === "admin" || realRole === ("ultra_admin" as UserRole)),
    startImpersonation,
    stopImpersonation,
  };

  return <ImpersonationContext.Provider value={value}>{children}</ImpersonationContext.Provider>;
}

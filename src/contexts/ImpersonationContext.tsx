import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { monitoring } from "@/lib/monitoring";
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
    const valid: UserRole[] = ["admin", "financeiro", "marketing", "operacional", "user"];
    return (valid as string[]).includes(raw) ? (raw as UserRole) : null;
  } catch {
    return null;
  }
}

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const realRole = (profile?.role ?? null) as UserRole | null;
  const [viewAsRole, setViewAsRole] = useState<UserRole | null>(null);

  useEffect(() => {
    if (realRole !== "admin") {
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
      if (realRole !== "admin") return;
      if (role === "admin") return;
      setViewAsRole(role);
      try {
        localStorage.setItem(STORAGE_KEY, role);
      } catch {
        /* noop */
      }
      monitoring.captureMessage("impersonation_start", "warning", { role });
    },
    [realRole]
  );

  const stopImpersonation = useCallback(() => {
    setViewAsRole(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    monitoring.captureMessage("impersonation_stop", "info");
  }, []);

  const value: ImpersonationContextValue = {
    viewAsRole,
    isImpersonating: viewAsRole !== null && realRole === "admin",
    startImpersonation,
    stopImpersonation,
  };

  return <ImpersonationContext.Provider value={value}>{children}</ImpersonationContext.Provider>;
}

import type { Database } from "@/integrations/supabase/types";

export type LegacyUserRole = Database["public"]["Enums"]["user_role"];

export type PilarRole = "ultra_admin" | "admin" | "user";

const ULTRA_ADMIN_PREVIEW_KEY = "pilar-ultra-admin-preview";

/**
 * Ultra admin é promovido APENAS via SQL direto no Supabase
 * (UPDATE profiles SET role = 'ultra_admin' WHERE email = '...').
 * Nenhuma UI — nem do admin da empresa — pode conceder esse papel.
 *
 * O bypass via localStorage existe apenas para preview em desenvolvimento
 * local (npm run dev). Em build de produção, `import.meta.env.DEV` é
 * substituído por `false` em compile time pelo Vite, e o bloco é removido
 * pelo tree-shake — não há código de bypass no bundle final.
 */
export function isUltraAdmin(role: string | null | undefined): boolean {
  if (role === "ultra_admin") return true;
  if (!import.meta.env.DEV) return false;
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ULTRA_ADMIN_PREVIEW_KEY) === "1";
  } catch {
    return false;
  }
}

/** Preview toggle — exclusivo do modo DEV. No-op em produção. */
export function setUltraAdminPreview(enabled: boolean): void {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;
  try {
    if (enabled) {
      window.localStorage.setItem(ULTRA_ADMIN_PREVIEW_KEY, "1");
    } else {
      window.localStorage.removeItem(ULTRA_ADMIN_PREVIEW_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function canPreviewUltraAdmin(): boolean {
  return Boolean(import.meta.env.DEV);
}

export function isLegacyAdmin(role: LegacyUserRole | null | undefined): boolean {
  return role === "admin";
}

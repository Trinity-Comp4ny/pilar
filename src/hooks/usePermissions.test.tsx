import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImpersonationContext } from "@/contexts/ImpersonationContext";
import { FEATURES } from "@/lib/features";
import type { UserRole } from "@/lib/permissions";
import { useFeatureAccess } from "./useFeatureAccess";
import { usePermissions } from "./usePermissions";

const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

// Módulo que a empresa liga e desliga (nem core, nem universal, nem sub-feature).
const MODULO = FEATURES.find((f) => !f.core && !f.universal && !f.parent)!.key;

function perfil(p: Record<string, unknown>) {
  mockUseAuth.mockReturnValue({ profile: { empresas: { features: { [MODULO]: true } }, ...p } });
}

function comImpersonation(viewAsRole: UserRole | null) {
  return ({ children }: { children: ReactNode }) => (
    <ImpersonationContext.Provider
      value={{
        viewAsRole,
        isImpersonating: !!viewAsRole,
        loading: false,
        startImpersonation: vi.fn(),
        stopImpersonation: vi.fn(),
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

beforeEach(() => mockUseAuth.mockReset());

describe("usePermissions", () => {
  it("sem perfil não libera nada", () => {
    mockUseAuth.mockReturnValue({ profile: null });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can("projetos")).toBe(false);
    expect(result.current.isAdmin).toBe(false);
  });

  it("admin acessa portal de admin e financeiro", () => {
    perfil({ role: "admin" });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.can("admin_portal")).toBe(true);
    expect(result.current.can("financeiro", "edit")).toBe(true);
  });

  it("colaborador não vê financeiro e o botão explica o motivo", () => {
    perfil({ role: "colaborador" });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.cannot("financeiro")).toBe(true);
    expect(result.current.getButtonProps("financeiro")).toEqual({
      disabled: true,
      "aria-disabled": true,
      title: "Requer perfil Admin ou acesso financeiro concedido por um administrador",
    });
    expect(result.current.getNavItemProps("billing").disabled).toBe(true);
  });

  it("coordenador com financeiro delegado vê financeiro, mas não folha", () => {
    perfil({ role: "coordenador", financeiro_delegado: true });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can("financeiro")).toBe(true);
    expect(result.current.can("financeiro_folha")).toBe(false);
  });

  it("módulo desligado na empresa bloqueia quem não é ultra admin", () => {
    mockUseAuth.mockReturnValue({ profile: { role: "admin", empresas: { features: { [MODULO]: false } } } });
    expect(renderHook(() => usePermissions()).result.current.can(MODULO)).toBe(false);

    mockUseAuth.mockReturnValue({ profile: { role: "ultra_admin", empresas: { features: { [MODULO]: false } } } });
    expect(renderHook(() => usePermissions()).result.current.can(MODULO)).toBe(true);
  });

  it("admin vendo como colaborador perde o acesso de admin; o papel real continua", () => {
    perfil({ role: "admin" });
    const { result } = renderHook(() => usePermissions(), { wrapper: comImpersonation("colaborador" as UserRole) });
    expect(result.current.role).toBe("colaborador");
    expect(result.current.realRole).toBe("admin");
    expect(result.current.isImpersonating).toBe(true);
    expect(result.current.can("admin_portal")).toBe(false);
  });

  it("quem não é admin não troca de papel por impersonation", () => {
    perfil({ role: "colaborador" });
    const { result } = renderHook(() => usePermissions(), { wrapper: comImpersonation("admin" as UserRole) });
    expect(result.current.role).toBe("colaborador");
    expect(result.current.can("admin_portal")).toBe(false);
  });
});

describe("useFeatureAccess", () => {
  it("admin edita", () => {
    perfil({ role: "admin" });
    const { result } = renderHook(() => useFeatureAccess(MODULO));
    expect(result.current).toMatchObject({ canView: true, canEdit: true, isViewerOnly: false, level: "editor" });
  });

  it("sem acesso não tem nível", () => {
    perfil({ role: "colaborador" });
    const { result } = renderHook(() => useFeatureAccess("financeiro"));
    expect(result.current).toMatchObject({ canView: false, canEdit: false, level: null, isAdmin: false });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

const perms = vi.hoisted(() => ({
  isAdmin: true,
  role: "admin" as string,
  bloqueadas: new Set<string>(),
}));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    isAdmin: perms.isAdmin,
    role: perms.role,
    getNavItemProps: (f: string) =>
      perms.bloqueadas.has(f) ? { disabled: true, title: "Sem acesso" } : { disabled: false, title: "" },
  }),
}));

import { useModuleNav } from "./useModuleNav";
import { ULTIMO_MODULO_KEY } from "@/lib/modules";

function montar(rota: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[rota]}>{children}</MemoryRouter>
  );
  return renderHook(() => ({ nav: useModuleNav(), location: useLocation() }), { wrapper });
}

beforeEach(() => {
  localStorage.clear();
  perms.isAdmin = true;
  perms.role = "admin";
  perms.bloqueadas = new Set();
});

describe("useModuleNav", () => {
  it("módulo da rota vira ativo e é lembrado", () => {
    const { result } = montar("/gestao/leads?view=lista");
    expect(result.current.nav.routeModule).toBe("gestao");
    expect(result.current.nav.activeModule).toBe("gestao");
    expect(result.current.nav.currentPath).toBe("/gestao/leads");
    expect(result.current.nav.currentView).toBe("lista");
    expect(localStorage.getItem(ULTIMO_MODULO_KEY)).toBe("gestao");
  });

  it("agrupa itens consecutivos pelo rótulo do grupo", () => {
    const { result } = montar("/gestao/tarefas");
    expect(result.current.nav.moduleGroups.map((g) => g.label)).toEqual(["Empresa", "Comercial"]);
  });

  it("itens sem grupo caem num bloco único sem rótulo", () => {
    const { result } = montar("/projetos");
    expect(result.current.nav.moduleGroups).toHaveLength(1);
    expect(result.current.nav.moduleGroups[0].label).toBeNull();
  });

  it("rota transversal usa o último módulo salvo sem regravar", () => {
    localStorage.setItem(ULTIMO_MODULO_KEY, "obras");
    const { result } = montar("/inicio");
    expect(result.current.nav.routeModule).toBeNull();
    expect(result.current.nav.activeModule).toBe("obras");
    expect(localStorage.getItem(ULTIMO_MODULO_KEY)).toBe("obras");
  });

  it("usuário comum não vê feature delegável bloqueada; coordenador vê cinza", () => {
    perms.bloqueadas = new Set(["financeiro"]);
    perms.isAdmin = false;
    perms.role = "user";
    const user = montar("/gestao/tarefas");
    const titulosUser = user.result.current.nav.moduleGroups.flatMap((g) => g.entries.map((e) => e.item.title));
    expect(titulosUser).not.toContain("Financeiro");

    perms.role = "coordenador";
    const coord = montar("/gestao/tarefas");
    const fin = coord.result.current.nav.moduleGroups
      .flatMap((g) => g.entries)
      .find((e) => e.item.title === "Financeiro");
    expect(fin?.nav).toEqual({ disabled: true, title: "Sem acesso" });
  });

  it("módulo sem nenhuma feature liberada some do switcher; Obras (em breve) fica", () => {
    perms.bloqueadas = new Set(["projetos", "mapa", "ai_chat"]);
    const { result } = montar("/inicio");
    expect(result.current.nav.visibleModules).not.toContain("projetos");
    expect(result.current.nav.visibleModules).toContain("gestao");
    expect(result.current.nav.empresaItems).toEqual([]);
  });

  it("empresaItems lista os liberados", () => {
    const { result } = montar("/inicio");
    expect(result.current.nav.empresaItems.map((e) => e.item.url)).toEqual(["/agentes"]);
  });

  it("selectModule salva, navega para a home e chama o callback", () => {
    const after = vi.fn();
    const { result } = montar("/inicio");
    act(() => result.current.nav.selectModule("gestao", after));
    expect(result.current.location.pathname).toBe("/gestao/tarefas");
    expect(localStorage.getItem(ULTIMO_MODULO_KEY)).toBe("gestao");
    expect(after).toHaveBeenCalled();
    act(() => result.current.nav.selectModule("projetos"));
    expect(result.current.location.pathname).toBe("/projetos");
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const auth = vi.hoisted(() => ({ user: { id: "u1" } as { id: string } | null }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import { useRecentes, useRegistrarPagina } from "./useRecentes";

// O cache do módulo vive entre testes: cada teste usa um usuário próprio.
let seq = 0;
const novoUsuario = () => {
  auth.user = { id: `user-${++seq}` };
  return auth.user.id;
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useRecentes", () => {
  it("sem usuário: vazio e registrar não faz nada", () => {
    auth.user = null;
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const { result } = renderHook(() => useRecentes());
    expect(result.current.recentes).toEqual([]);
    act(() => result.current.registrar({ tipo: "pagina", rota: "/x", label: "X" }));
    expect(setItem).not.toHaveBeenCalled();
  });

  it("lê do localStorage do usuário, descartando itens inválidos", () => {
    const id = novoUsuario();
    localStorage.setItem(
      `pilar.recentes.${id}`,
      JSON.stringify([{ tipo: "projeto", rota: "/projetos/1", label: "P1", ts: 1 }, null, { rota: 2 }, "lixo"])
    );
    const { result } = renderHook(() => useRecentes());
    expect(result.current.recentes).toEqual([{ tipo: "projeto", rota: "/projetos/1", label: "P1", ts: 1 }]);
  });

  it("JSON corrompido ou não-array vira lista vazia", () => {
    const a = novoUsuario();
    localStorage.setItem(`pilar.recentes.${a}`, "{nao json");
    expect(renderHook(() => useRecentes()).result.current.recentes).toEqual([]);

    const b = novoUsuario();
    localStorage.setItem(`pilar.recentes.${b}`, JSON.stringify({ rota: "/x" }));
    expect(renderHook(() => useRecentes()).result.current.recentes).toEqual([]);
  });

  it("registra no topo, deduplica por rota, limita a 8 e sincroniza instâncias", () => {
    const id = novoUsuario();
    const a = renderHook(() => useRecentes());
    const b = renderHook(() => useRecentes());
    act(() => {
      for (let i = 0; i < 9; i++) a.result.current.registrar({ tipo: "pagina", rota: `/r${i}`, label: `R${i}` });
      a.result.current.registrar({ tipo: "pagina", rota: "/r5", label: "R5 de novo" });
    });
    const rotas = b.result.current.recentes.map((r) => r.rota);
    expect(rotas).toHaveLength(8);
    expect(rotas[0]).toBe("/r5");
    expect(rotas.filter((r) => r === "/r5")).toHaveLength(1);
    expect(rotas).not.toContain("/r0");
    expect(JSON.parse(localStorage.getItem(`pilar.recentes.${id}`)!)[0].label).toBe("R5 de novo");
  });

  it("storage cheio: segue em memória sem erro", () => {
    novoUsuario();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    const { result } = renderHook(() => useRecentes());
    act(() => result.current.registrar({ tipo: "lead", rota: "/gestao/leads", label: "Leads" }));
    expect(result.current.recentes.map((r) => r.rota)).toEqual(["/gestao/leads"]);
  });

  it("useRegistrarPagina registra ao montar", () => {
    novoUsuario();
    renderHook(() => useRegistrarPagina("pagina", "/gestao/clientes", "Clientes"));
    const { result } = renderHook(() => useRecentes());
    expect(result.current.recentes[0]).toMatchObject({ rota: "/gestao/clientes", label: "Clientes" });
  });
});

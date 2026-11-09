import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ehTema } from "@/pages/inicio/hero/temas";
import { useTemaInicio } from "./useTemaInicio";

/**
 * Preferência do cabeçalho do Início no navegador, por usuário: lê com
 * tolerância a lixo, grava a cada troca e sobrevive a localStorage bloqueado.
 */

const h = vi.hoisted(() => ({ profile: { id: "u1" } as { id: string } | null }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ profile: h.profile }) }));

const CHAVE = "pilar:inicio:cabecalho:u1";

beforeEach(() => {
  localStorage.clear();
  h.profile = { id: "u1" };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useTemaInicio", () => {
  it("sem preferência salva usa o padrão", () => {
    const { result } = renderHook(() => useTemaInicio());
    expect(result.current.tema).toBe("verde");
    expect(result.current.mostrarResumo).toBe(true);
  });

  it("lê o que estava salvo para o usuário", () => {
    localStorage.setItem(CHAVE, JSON.stringify({ tema: "grafite", mostrarResumo: false }));
    const { result } = renderHook(() => useTemaInicio());
    expect(result.current).toMatchObject({ tema: "grafite", mostrarResumo: false });
  });

  it.each([
    ["JSON quebrado", "{não é json"],
    ["valor nulo", "null"],
    ["tipo errado", JSON.stringify("grafite")],
  ])("%s volta ao padrão", (_c, bruto) => {
    localStorage.setItem(CHAVE, bruto);
    const { result } = renderHook(() => useTemaInicio());
    expect(result.current).toMatchObject({ tema: "verde", mostrarResumo: true });
  });

  it("campo inválido cai no padrão só naquele campo", () => {
    localStorage.setItem(CHAVE, JSON.stringify({ tema: "neon", mostrarResumo: false }));
    const { result } = renderHook(() => useTemaInicio());
    expect(result.current).toMatchObject({ tema: "verde", mostrarResumo: false });
  });

  it("trocar tema e resumo grava na chave do usuário sem perder o outro campo", () => {
    const { result } = renderHook(() => useTemaInicio());
    act(() => result.current.setTema("papel"));
    act(() => result.current.setMostrarResumo(false));
    expect(result.current).toMatchObject({ tema: "papel", mostrarResumo: false });
    expect(JSON.parse(localStorage.getItem(CHAVE)!)).toEqual({ tema: "papel", mostrarResumo: false });
  });

  it("perfil que chega depois relê a preferência do dono certo", () => {
    localStorage.setItem(CHAVE, JSON.stringify({ tema: "grafite", mostrarResumo: true }));
    h.profile = null;
    const { result, rerender } = renderHook(() => useTemaInicio());
    expect(result.current.tema).toBe("verde");
    h.profile = { id: "u1" };
    rerender();
    expect(result.current.tema).toBe("grafite");
  });

  it("anônimo grava numa chave própria", () => {
    h.profile = null;
    const { result } = renderHook(() => useTemaInicio());
    act(() => result.current.setTema("grafite"));
    expect(localStorage.getItem("pilar:inicio:cabecalho:anon")).toContain("grafite");
  });

  it("localStorage bloqueado: lê o padrão e a troca vale na sessão", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    const { result } = renderHook(() => useTemaInicio());
    expect(result.current.tema).toBe("verde");
    act(() => result.current.setTema("papel"));
    expect(result.current.tema).toBe("papel");
  });
});

describe("ehTema", () => {
  it("aceita só os temas conhecidos", () => {
    expect(ehTema("verde")).toBe(true);
    expect(ehTema("papel")).toBe(true);
    expect(ehTema("Verde")).toBe(false);
    expect(ehTema(1)).toBe(false);
    expect(ehTema(undefined)).toBe(false);
  });
});

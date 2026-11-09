import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useColunasLista } from "./colunas";
import { corDaEtapa, isPrioridade, isStatusBucket, toPrioridade } from "./status";

/**
 * Preferência de colunas da lista (localStorage, tolerante a lixo e a storage
 * bloqueado) e os guardas de status/prioridade que validam o que vem do banco.
 */

const LS = "pilar.meu-trabalho.colunas";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("useColunasLista", () => {
  it("padrão liga projeto, responsável, prazo e prioridade, em ordem canônica", () => {
    const { result } = renderHook(() => useColunasLista());
    expect(result.current.ativas).toEqual(["projeto", "responsavel", "prazo", "prioridade"]);
  });

  it("mescla o salvo com o padrão e descarta valor inválido", () => {
    localStorage.setItem(LS, JSON.stringify({ projeto: false, horas: true, prazo: "sim", fantasma: true }));
    const { result } = renderHook(() => useColunasLista());
    expect(result.current.visiveis.projeto).toBe(false);
    expect(result.current.visiveis.horas).toBe(true);
    expect(result.current.visiveis.prazo).toBe(true);
    expect(result.current.visiveis).not.toHaveProperty("fantasma");
  });

  it("JSON corrompido volta ao padrão", () => {
    localStorage.setItem(LS, "{");
    const { result } = renderHook(() => useColunasLista());
    expect(result.current.ativas).toHaveLength(4);
  });

  it("alternar liga/desliga e persiste", () => {
    const { result } = renderHook(() => useColunasLista());
    act(() => result.current.alternar("etiquetas"));
    act(() => result.current.alternar("projeto"));
    expect(result.current.ativas).toEqual(["responsavel", "prazo", "prioridade", "etiquetas"]);
    expect(JSON.parse(localStorage.getItem(LS)!)).toMatchObject({ etiquetas: true, projeto: false });
  });

  it("storage bloqueado não quebra a lista", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    const { result } = renderHook(() => useColunasLista());
    act(() => result.current.alternar("horas"));
    expect(result.current.visiveis.horas).toBe(true);
  });
});

describe("status e prioridade", () => {
  it("guardas aceitam só os valores canônicos", () => {
    expect(isStatusBucket("fazendo")).toBe(true);
    expect(isStatusBucket("Fazendo")).toBe(false);
    expect(isStatusBucket(null)).toBe(false);
    expect(isPrioridade("baixa")).toBe(true);
    expect(isPrioridade("urgente")).toBe(false);
  });

  it("prioridade desconhecida vira média", () => {
    expect(toPrioridade("alta")).toBe("alta");
    expect(toPrioridade("Alta")).toBe("media");
    expect(toPrioridade(undefined)).toBe("media");
  });

  it("cor da etapa: escolhida, padrão do balde ou cinza", () => {
    expect(corDaEtapa("#123456", "fazendo")).toBe("#123456");
    expect(corDaEtapa(null, "fazendo")).toBe("#f59e0b");
    expect(corDaEtapa(null, "concluida")).toBe("#10b981");
    expect(corDaEtapa(null, null)).toBe("#94a3b8");
  });
});

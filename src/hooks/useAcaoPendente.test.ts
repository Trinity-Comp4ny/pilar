import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAcaoPendente } from "./useAcaoPendente";

function adiavel<T>() {
  let resolver!: (v: T) => void;
  let rejeitar!: (e: unknown) => void;
  const promessa = new Promise<T>((res, rej) => {
    resolver = res;
    rejeitar = rej;
  });
  return { promessa, resolver, rejeitar };
}

describe("useAcaoPendente", () => {
  it("marca a chave como pendente até a ação terminar", async () => {
    const { result } = renderHook(() => useAcaoPendente());
    const a = adiavel<string>();
    let retorno: Promise<string | undefined>;
    act(() => {
      retorno = result.current.executar("linha-1", () => a.promessa);
    });
    expect(result.current.pendente("linha-1")).toBe(true);
    expect(result.current.pendente("linha-2")).toBe(false);
    expect(result.current.algumaPendente).toBe(true);
    await act(async () => {
      a.resolver("ok");
      await retorno;
    });
    expect(result.current.pendente("linha-1")).toBe(false);
    expect(result.current.algumaPendente).toBe(false);
    await expect(retorno!).resolves.toBe("ok");
  });

  it("ignora o segundo clique na mesma chave enquanto a primeira roda", async () => {
    const { result } = renderHook(() => useAcaoPendente());
    const a = adiavel<void>();
    let chamadas = 0;
    const acao = () => {
      chamadas++;
      return a.promessa;
    };
    let p1: Promise<void | undefined>;
    let p2: Promise<void | undefined>;
    act(() => {
      p1 = result.current.executar("x", acao);
      p2 = result.current.executar("x", acao);
    });
    await act(async () => {
      a.resolver();
      await Promise.all([p1, p2]);
    });
    expect(chamadas).toBe(1);
  });

  it("libera a chave mesmo quando a ação falha, e repassa o erro", async () => {
    const { result } = renderHook(() => useAcaoPendente());
    const a = adiavel<void>();
    let retorno: Promise<void | undefined>;
    act(() => {
      retorno = result.current.executar("x", () => a.promessa);
    });
    expect(result.current.pendente("x")).toBe(true);
    await act(async () => {
      a.rejeitar(new Error("falhou"));
      await retorno.catch(() => undefined);
    });
    await expect(retorno!).rejects.toThrow("falhou");
    expect(result.current.pendente("x")).toBe(false);
  });

  it("chaves diferentes rodam ao mesmo tempo", async () => {
    const { result } = renderHook(() => useAcaoPendente());
    const a = adiavel<void>();
    const b = adiavel<void>();
    let pa: Promise<void | undefined>;
    let pb: Promise<void | undefined>;
    act(() => {
      pa = result.current.executar("a", () => a.promessa);
      pb = result.current.executar("b", () => b.promessa);
    });
    expect(result.current.pendente("a")).toBe(true);
    expect(result.current.pendente("b")).toBe(true);
    await act(async () => {
      a.resolver();
      await pa;
    });
    expect(result.current.pendente("a")).toBe(false);
    expect(result.current.pendente("b")).toBe(true);
    await act(async () => {
      b.resolver();
      await pb;
    });
  });
});

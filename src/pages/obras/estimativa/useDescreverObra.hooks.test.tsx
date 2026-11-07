import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import type { ReactNode } from "react";

const auth = vi.hoisted(() => ({ empresaId: "emp-1" as string | null }));
vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ profile: auth.empresaId ? { empresa_id: auth.empresaId } : null }),
}));

import { fake } from "@/pages/obras/testing/supabaseFake";
import { FalhaDaIa, useInterpretarObra, useSaldoDeTokens } from "./useDescreverObra";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function erroHttp(status: number, corpo: unknown, jsonFalha = false) {
  const resposta = {
    status,
    json: jsonFalha ? () => Promise.reject(new Error("não é json")) : () => Promise.resolve(corpo),
  };
  return new FunctionsHttpError(resposta);
}

async function interpretar(texto = "casa com 3 quartos") {
  const { result } = renderHook(() => useInterpretarObra(), { wrapper: wrapper() });
  let falha: unknown = null;
  let dado: unknown = null;
  await act(async () => {
    try {
      dado = await result.current.mutateAsync(texto);
    } catch (e) {
      falha = e;
    }
  });
  return { falha: falha as FalhaDaIa | null, dado };
}

beforeEach(() => {
  fake.reset();
  auth.empresaId = "emp-1";
});

describe("useInterpretarObra", () => {
  it("resposta válida passa pelo schema com os padrões", async () => {
    fake.invoke.mockResolvedValue({ data: { itens: [{ id: "ac12", quantidade: 6 }] }, error: null });
    const { dado, falha } = await interpretar("6 splits");
    expect(falha).toBeNull();
    expect(fake.invoke).toHaveBeenCalledWith("ai-estimativa-itens", { body: { descricao: "6 splits" } });
    expect(dado).toEqual(
      expect.objectContaining({ itens: [{ id: "ac12", quantidade: 6, trecho: "" }], perguntas: [], marcenaria: null })
    );
  });

  it("resposta fora do formato vira falha 'invalida'", async () => {
    fake.invoke.mockResolvedValue({ data: { itens: [{ id: "nao-existe", quantidade: 1 }] }, error: null });
    const { falha } = await interpretar();
    expect(falha).toBeInstanceOf(FalhaDaIa);
    expect(falha!.tipo).toBe("invalida");
  });

  it("402 com mensagem do servidor é bloqueio que a pessoa resolve", async () => {
    fake.invoke.mockResolvedValue({ data: null, error: erroHttp(402, { error: "Tokens acabaram." }) });
    const { falha } = await interpretar();
    expect(falha).toMatchObject({ tipo: "bloqueio", message: "Tokens acabaram." });
  });

  it("corpo ilegível ou erro de rede viram erro genérico", async () => {
    fake.invoke.mockResolvedValue({ data: null, error: erroHttp(500, null, true) });
    expect((await interpretar()).falha).toMatchObject({ tipo: "erro", message: "Não consegui falar com a IA agora." });

    fake.invoke.mockResolvedValue({ data: null, error: new Error("Failed to fetch") });
    expect((await interpretar()).falha).toMatchObject({ tipo: "erro" });
  });
});

describe("useSaldoDeTokens", () => {
  it("soma o saldo do plano e o comprado (nulos como zero)", async () => {
    fake.responder((c) =>
      c.tabela === "ai_token_saldo" ? { data: { saldo_plano: 1000, saldo_comprado: null }, error: null } : undefined
    );
    const { result } = renderHook(() => useSaldoDeTokens(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(1000);
    expect(fake.chamadas[0].filtros).toContainEqual(["eq", "empresa_id", "emp-1"]);

    fake.responder(() => ({ data: { saldo_plano: null, saldo_comprado: 50 }, error: null }));
    const outro = renderHook(() => useSaldoDeTokens(), { wrapper: wrapper() });
    await waitFor(() => expect(outro.result.current.data).toBe(50));
  });

  it("sem linha ou com erro devolve null", async () => {
    fake.responder(() => ({ data: null, error: null }));
    const vazio = renderHook(() => useSaldoDeTokens(), { wrapper: wrapper() });
    await waitFor(() => expect(vazio.result.current.isSuccess).toBe(true));
    expect(vazio.result.current.data).toBeNull();

    fake.responder(() => ({ data: null, error: { message: "rls" } }));
    const erro = renderHook(() => useSaldoDeTokens(), { wrapper: wrapper() });
    await waitFor(() => expect(erro.result.current.isSuccess).toBe(true));
    expect(erro.result.current.data).toBeNull();
  });

  it("sem empresa no perfil não consulta", () => {
    auth.empresaId = null;
    const { result } = renderHook(() => useSaldoDeTokens(), { wrapper: wrapper() });
    expect(result.current.fetchStatus).toBe("idle");
    expect(fake.chamadas).toHaveLength(0);
  });
});

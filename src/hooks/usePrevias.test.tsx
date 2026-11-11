import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabaseFake } from "@/hooks/testing/supabaseFake";

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/hooks/testing/supabaseFake")).supabaseFake.client,
}));
const h = vi.hoisted(() => ({ user: { id: "u1" } as { id: string } | null }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: h.user }) }));

import { useAlternarPrevia, usePrevia, usePrevias } from "./usePrevias";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

const RECURSOS = [
  { chave: "gantt-novo", nome: "Gantt novo", descricao: "x" },
  { chave: "busca-ia", nome: "Busca com IA", descricao: "y" },
];

beforeEach(() => {
  supabaseFake.reset();
  h.user = { id: "u1" };
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});

describe("usePrevias (SPEC 160)", () => {
  it("não busca sem sessão", () => {
    h.user = null;
    const { result } = renderHook(() => usePrevias(), { wrapper });
    expect(result.current.recursos).toEqual([]);
    expect(supabaseFake.calls).toHaveLength(0);
  });

  it("lista os recursos ativos e as prévias que a pessoa ligou", async () => {
    supabaseFake.respond("recursos_previa", "select", { data: RECURSOS });
    supabaseFake.respond("usuario_previas", "select", { data: [{ chave: "gantt-novo" }] });
    const { result } = renderHook(() => usePrevias(), { wrapper });
    await waitFor(() => expect(result.current.recursos).toHaveLength(2));
    expect([...result.current.ligadas]).toEqual(["gantt-novo"]);
    expect(supabaseFake.callsTo("usuario_previas", "select")[0].chain).toContainEqual(["eq", ["user_id", "u1"]]);
  });

  it("erro em qualquer das duas consultas deixa a lista vazia", async () => {
    supabaseFake.respond("recursos_previa", "select", { data: RECURSOS });
    supabaseFake.respond("usuario_previas", "select", { error: { message: "rls" } });
    const { result } = renderHook(() => usePrevias(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.recursos).toEqual([]);
  });

  it("erro no catálogo também", async () => {
    supabaseFake.respond("recursos_previa", "select", { error: { message: "rls" } });
    const { result } = renderHook(() => usePrevias(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.recursos).toEqual([]);
  });
});

describe("usePrevia", () => {
  it("só vale para recurso ligado e ainda ativo", async () => {
    supabaseFake.respond("recursos_previa", "select", { data: RECURSOS.slice(1) });
    supabaseFake.respond("usuario_previas", "select", { data: [{ chave: "gantt-novo" }, { chave: "busca-ia" }] });
    const ativo = renderHook(() => usePrevia("busca-ia"), { wrapper });
    await waitFor(() => expect(ativo.result.current).toBe(true));
    // Ligada, mas o recurso saiu do catálogo: não aparece.
    const retirado = renderHook(() => usePrevia("gantt-novo"), { wrapper });
    expect(retirado.result.current).toBe(false);
  });
});

describe("useAlternarPrevia", () => {
  it("ligar insere a prévia da pessoa", async () => {
    const { result } = renderHook(() => useAlternarPrevia(), { wrapper });
    await result.current.mutateAsync({ chave: "busca-ia", ligar: true });
    expect(supabaseFake.callsTo("usuario_previas", "insert")[0].payload).toEqual({ user_id: "u1", chave: "busca-ia" });
  });

  it("desligar apaga só a prévia daquela pessoa", async () => {
    const { result } = renderHook(() => useAlternarPrevia(), { wrapper });
    await result.current.mutateAsync({ chave: "busca-ia", ligar: false });
    const chamada = supabaseFake.callsTo("usuario_previas", "delete")[0];
    expect(chamada.chain).toContainEqual(["eq", ["user_id", "u1"]]);
    expect(chamada.chain).toContainEqual(["eq", ["chave", "busca-ia"]]);
  });

  it("propaga o erro", async () => {
    supabaseFake.respond("usuario_previas", "insert", { error: { message: "x" } });
    const { result } = renderHook(() => useAlternarPrevia(), { wrapper });
    await expect(result.current.mutateAsync({ chave: "busca-ia", ligar: true })).rejects.toEqual({ message: "x" });
  });
});

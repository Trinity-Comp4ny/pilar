import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabaseFake } from "@/hooks/testing/supabaseFake";
const storage = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn() }));
vi.mock("@/integrations/supabase/client", async () => ({
  supabase: { ...(await import("@/hooks/testing/supabaseFake")).supabaseFake.client, storage: { from: () => storage } },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
import { usePropostaVersoes } from "./usePropostaVersoes";
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const arquivo = {
  name: "proposta.pdf",
  size: 8,
  slice: () => ({ arrayBuffer: async () => new TextEncoder().encode("%PDF-").buffer }),
} as File;
const input = {
  propostaId: "proposta",
  arquivo,
  valor: 1500,
  validade: "2026-12-17",
  condicoes: "Entrada e saldo",
  motivo: "Ajuste de ambiente",
};
beforeEach(() => {
  supabaseFake.reset();
  vi.clearAllMocks();
  supabaseFake.respondRpc("get_user_empresa_id", { data: "empresa" });
  storage.upload.mockResolvedValue({ error: null });
  storage.remove.mockResolvedValue({ error: null });
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});
describe("revisões em PDF", () => {
  it("salva snapshot e arquivo privado sem marcar envio", async () => {
    const { result } = renderHook(() => usePropostaVersoes("lead", [], true), { wrapper });
    await act(async () => {
      await result.current.adicionar.mutateAsync(input);
    });
    const call = supabaseFake.calls.find((c) => c.table === "proposta_versoes" && c.op === "insert");
    expect(call?.payload).toMatchObject({
      proposta_id: "proposta",
      valor_proposto: 1500,
      condicoes_pagamento: "Entrada e saldo",
      motivo_revisao: "Ajuste de ambiente",
    });
    expect(call?.payload).not.toHaveProperty("enviado_em");
    expect(storage.upload.mock.calls[0][0]).toMatch(/^empresa\/proposta\/.+\.pdf$/);
    expect(storage.upload.mock.calls[0][2]).toEqual({ contentType: "application/pdf", upsert: false });
  });
  it("remove upload órfão se gravar metadados falhar", async () => {
    supabaseFake.respond("proposta_versoes", "insert", { error: { message: "negado" } });
    const { result } = renderHook(() => usePropostaVersoes("lead", [], true), { wrapper });
    await act(async () => {
      await expect(result.current.adicionar.mutateAsync(input)).rejects.toEqual({ message: "negado" });
    });
    expect(storage.remove).toHaveBeenCalledWith([storage.upload.mock.calls[0][0]]);
  });
  it("falha de upload não cria revisão", async () => {
    storage.upload.mockResolvedValue({ error: { message: "offline" } });
    const { result } = renderHook(() => usePropostaVersoes("lead", [], true), { wrapper });
    await act(async () => {
      await expect(result.current.adicionar.mutateAsync(input)).rejects.toEqual({ message: "offline" });
    });
    expect(supabaseFake.calls.some((c) => c.op === "insert")).toBe(false);
  });
});

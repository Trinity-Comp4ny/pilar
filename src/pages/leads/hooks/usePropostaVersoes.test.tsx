import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabaseFake } from "@/hooks/testing/supabaseFake";
const storage = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn(), download: vi.fn() }));
vi.mock("@/integrations/supabase/client", async () => ({
  supabase: { ...(await import("@/hooks/testing/supabaseFake")).supabaseFake.client, storage: { from: () => storage } },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("file-saver", () => ({ saveAs: vi.fn() }));
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { usePropostaVersoes } from "@/hooks/usePropostaVersoes";
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

describe("consulta, envio externo e download", () => {
  it("consulta somente as propostas informadas e expõe falha de leitura", async () => {
    supabaseFake.respond("proposta_versoes", "select", { error: { message: "sem acesso" } });
    const { result } = renderHook(() => usePropostaVersoes("lead", ["p1", "p2"], true), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(supabaseFake.calls[0].chain).toContainEqual(["in", ["proposta_id", ["p1", "p2"]]]);
  });
  it("consulta o histórico e registra envio uma vez, invalidando os dados", async () => {
    supabaseFake.respond("proposta_versoes", "select", { data: [{ id: "v1", numero: 1 }] });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => usePropostaVersoes("lead", ["p1"], true), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([{ id: "v1", numero: 1 }]));
    await act(async () => {
      await result.current.registrarEnvio.mutateAsync("v1");
    });
    const call = supabaseFake.calls.find((c) => c.op === "update");
    expect(call?.chain).toContainEqual(["is", ["enviado_em", null]]);
    expect(call?.chain).toContainEqual(["eq", ["id", "v1"]]);
    expect(call?.chain).toContainEqual(["single", []]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["propostas"] });
  });
  it("não confirma um envio recusado pelo servidor", async () => {
    supabaseFake.respond("proposta_versoes", "update", { error: { message: "já enviado" } });
    const { result } = renderHook(() => usePropostaVersoes("lead", [], true), { wrapper });
    await act(async () => {
      await expect(result.current.registrarEnvio.mutateAsync("v1")).rejects.toEqual({ message: "já enviado" });
    });
    expect(toast.error).toHaveBeenCalledWith("Não foi possível registrar o envio.");
  });
  it("baixa o blob privado com o nome original, sem URL pública", async () => {
    const data = new Blob(["%PDF-"], { type: "application/pdf" });
    storage.download.mockResolvedValue({ data, error: null });
    const { result } = renderHook(() => usePropostaVersoes("lead", [], true), { wrapper });
    await act(async () => {
      await result.current.baixar("empresa/p1/v1.pdf", "Orçamento.pdf");
    });
    expect(storage.download).toHaveBeenCalledWith("empresa/p1/v1.pdf");
    expect(saveAs).toHaveBeenCalledWith(data, "Orçamento.pdf");
  });
  it("não salva arquivo quando o download é recusado", async () => {
    storage.download.mockResolvedValue({ data: null, error: { message: "negado" } });
    const { result } = renderHook(() => usePropostaVersoes("lead", [], true), { wrapper });
    await act(async () => {
      await result.current.baixar("p1/v1.pdf", "proposta.pdf");
    });
    expect(saveAs).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Não foi possível baixar o PDF.");
  });
  it.each([{ data: null }, { error: { message: "sem sessão" } }])(
    "não faz upload sem empresa autorizada: %j",
    async (response) => {
      supabaseFake.respondRpc("get_user_empresa_id", response);
      const { result } = renderHook(() => usePropostaVersoes("lead", [], true), { wrapper });
      await act(async () => {
        await expect(result.current.adicionar.mutateAsync(input)).rejects.toBeTruthy();
      });
      expect(storage.upload).not.toHaveBeenCalled();
    }
  );
  it("recusa arquivo inválido antes de consultar empresa ou subir arquivo", async () => {
    const { result } = renderHook(() => usePropostaVersoes("lead", [], true), { wrapper });
    await act(async () => {
      await expect(
        result.current.adicionar.mutateAsync({ ...input, arquivo: { ...arquivo, name: "foto.png" } as File })
      ).rejects.toThrow();
    });
    expect(storage.upload).not.toHaveBeenCalled();
    expect(supabaseFake.rpcCalls).toHaveLength(0);
  });
});

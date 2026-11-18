import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabaseFake } from "@/hooks/testing/supabaseFake";
vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/hooks/testing/supabaseFake")).supabaseFake.client,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
import { toast } from "sonner";
import { useLeadAtividades } from "./useLeadAtividades";
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
beforeEach(() => {
  supabaseFake.reset();
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});
describe("atividades do lead", () => {
  it("insere um registro por atividade, sem regravar as notas ou o histórico", async () => {
    supabaseFake.respondRpc("get_user_empresa_id", { data: "empresa" });
    const { result } = renderHook(() => useLeadAtividades("lead"), { wrapper });
    await act(async () => {
      await result.current.adicionar.mutateAsync({ texto: "Reunião marcada", ocorridoEm: "2026-11-17T15:00:00Z" });
    });
    expect(supabaseFake.calls.find((c) => c.op === "insert")?.payload).toEqual({
      empresa_id: "empresa",
      lead_id: "lead",
      texto: "Reunião marcada",
      mencionados: [],
      ocorrido_em: "2026-11-17T15:00:00Z",
    });
    expect(supabaseFake.calls.every((c) => c.table === "lead_atividades")).toBe(true);
  });
  it("não anuncia remoção quando RLS não removeu a linha", async () => {
    supabaseFake.respond("lead_atividades", "delete", { data: [] });
    const { result } = renderHook(() => useLeadAtividades("lead"), { wrapper });
    await act(async () => {
      await expect(result.current.excluir.mutateAsync("atividade")).rejects.toThrow("Atividade não removida");
    });
  });
  it("ordena por data da ocorrência e depois por criação", async () => {
    const { result } = renderHook(() => useLeadAtividades("lead"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(supabaseFake.calls[0].chain).toContainEqual(["eq", ["lead_id", "lead"]]);
    expect(supabaseFake.calls[0].chain).toContainEqual(["order", ["ocorrido_em"]]);
  });
});

describe("falhas e remoção autorizada", () => {
  it("expõe erro de consulta sem transformar erro em histórico vazio", async () => {
    supabaseFake.respond("lead_atividades", "select", { error: { message: "sem acesso" } });
    const { result } = renderHook(() => useLeadAtividades("lead"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual({ message: "sem acesso" });
  });
  it("remove a atividade vinculada ao lead e recarrega o histórico", async () => {
    supabaseFake.respond("lead_atividades", "delete", { data: [{ id: "a1" }] });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useLeadAtividades("lead"), { wrapper });
    await act(async () => {
      await result.current.excluir.mutateAsync("a1");
    });
    expect(supabaseFake.calls.find((c) => c.op === "delete")?.chain).toContainEqual(["eq", ["lead_id", "lead"]]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["lead-atividades", "lead"] });
  });
  it("propaga a recusa de exclusão", async () => {
    supabaseFake.respond("lead_atividades", "delete", { error: { message: "negado" } });
    const { result } = renderHook(() => useLeadAtividades("lead"), { wrapper });
    await act(async () => {
      await expect(result.current.excluir.mutateAsync("a1")).rejects.toEqual({ message: "negado" });
    });
    expect(toast.error).toHaveBeenCalledWith("Não foi possível remover a atividade.");
  });
  it.each([{ data: null }, { error: { message: "sem sessão" } }])(
    "recusa atividade sem empresa: %j",
    async (response) => {
      supabaseFake.respondRpc("get_user_empresa_id", response);
      const { result } = renderHook(() => useLeadAtividades("lead"), { wrapper });
      await act(async () => {
        await expect(
          result.current.adicionar.mutateAsync({ texto: "Contato", ocorridoEm: "2026-11-17T12:00:00Z" })
        ).rejects.toBeTruthy();
      });
      expect(supabaseFake.calls.some((c) => c.op === "insert")).toBe(false);
    }
  );
  it("informa erro quando salvar a atividade falha", async () => {
    supabaseFake.respondRpc("get_user_empresa_id", { data: "empresa" });
    supabaseFake.respond("lead_atividades", "insert", { error: { message: "offline" } });
    const { result } = renderHook(() => useLeadAtividades("lead"), { wrapper });
    await act(async () => {
      await expect(
        result.current.adicionar.mutateAsync({ texto: "Contato", ocorridoEm: "2026-11-17T12:00:00Z" })
      ).rejects.toEqual({ message: "offline" });
    });
    expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar a atividade. Tente novamente.");
  });
});

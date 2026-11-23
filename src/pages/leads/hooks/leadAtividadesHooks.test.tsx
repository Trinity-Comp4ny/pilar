import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { Lead } from "@/hooks/useLeads";
import { supabaseFake } from "@/hooks/testing/supabaseFake";
vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/hooks/testing/supabaseFake")).supabaseFake.client,
}));
import { useLeadPessoas } from "./useLeadPessoas";
import { useLeadAtividadeLink } from "./useLeadAtividadeLink";
let client: QueryClient;
beforeEach(() => {
  supabaseFake.reset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={["/gestao/leads?lead=l1&comentario=c1&v=lista"]}>
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  </MemoryRouter>
);
describe("pessoas e links de atividades", () => {
  it("consulta pessoas com conta e propaga erro de consulta", async () => {
    supabaseFake.respond("pessoas", "select", { error: { message: "negado" } });
    const { result } = renderHook(() => useLeadPessoas(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(supabaseFake.calls[0].chain).toContainEqual(["not", ["profile_id", "is", null]]);
  });
  it("retorna as pessoas disponíveis", async () => {
    supabaseFake.respond("pessoas", "select", { data: [{ id: "p1", nome: "Ana" }] });
    const { result } = renderHook(() => useLeadPessoas(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([{ id: "p1", nome: "Ana" }]));
  });
  it("abre o lead após carregar e limpa o destino ao fechar sem perder a visão", async () => {
    const select = vi.fn(),
      open = vi.fn();
    const { result, rerender } = renderHook(
      ({ leads }: { leads: Lead[] }) => ({ ...useLeadAtividadeLink(leads, select, open), location: useLocation() }),
      { wrapper, initialProps: { leads: [] as Lead[] } }
    );
    expect(select).not.toHaveBeenCalled();
    rerender({ leads: [{ id: "l1" } as Lead] });
    expect(select).toHaveBeenCalledWith({ id: "l1" });
    expect(open).toHaveBeenCalledWith(true);
    expect(result.current.comentarioDestacado).toBe("c1");
    act(() => result.current.onOpenChangeDetalhe(false));
    await waitFor(() => expect(result.current.location.search).toBe("?v=lista"));
    act(() => result.current.onOpenChangeDetalhe(true));
    expect(open).toHaveBeenLastCalledWith(true);
  });
});

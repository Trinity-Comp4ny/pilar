import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabaseFake } from "@/hooks/testing/supabaseFake";

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/hooks/testing/supabaseFake")).supabaseFake.client,
}));

import { useBuscaGlobal, escaparLike } from "./useBuscaGlobal";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  supabaseFake.reset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe("useBuscaGlobal", () => {
  it("termo com menos de 2 caracteres (após trim) não busca", () => {
    const { result } = renderHook(() => useBuscaGlobal("  a  "), { wrapper });
    expect(result.current.enabled).toBe(false);
    expect(result.current.grupos).toEqual([]);
    expect(supabaseFake.calls).toHaveLength(0);
  });

  it("agrupa por entidade com rota de cada tipo e omite grupos vazios", async () => {
    supabaseFake.respond("clientes", "select", { data: [{ id: "c1", nome: "Ana" }] });
    supabaseFake.respond("projetos", "select", { data: [{ id: "p1", nome: "Torre" }] });
    supabaseFake.respond("fornecedores", "select", { data: [{ id: "f1", nome: "Aço" }] });
    supabaseFake.respond("leads", "select", { data: [{ id: "l1", nome: "Lead" }] });
    supabaseFake.respond("propostas", "select", { data: [{ id: "pr1", titulo: "Proposta" }] });
    supabaseFake.respond("pessoas", "select", { data: null });

    const { result } = renderHook(() => useBuscaGlobal(" an "), { wrapper });
    await waitFor(() => expect(result.current.grupos).toHaveLength(5));

    expect(result.current.grupos.map((g) => [g.tipo, g.itens[0].rota, g.itens[0].label])).toEqual([
      ["cliente", "/gestao/clientes/c1", "Ana"],
      ["projeto", "/projetos/p1", "Torre"],
      ["fornecedor", "/obras/fornecedores/f1", "Aço"],
      ["lead", "/gestao/leads", "Lead"],
      ["proposta", "/gestao/propostas", "Proposta"],
    ]);
    expect(supabaseFake.callsTo("clientes")[0].chain).toContainEqual(["ilike", ["nome", "%an%"]]);
    expect(supabaseFake.callsTo("propostas")[0].chain).toContainEqual(["ilike", ["titulo", "%an%"]]);
    expect(supabaseFake.callsTo("pessoas")[0].chain).toContainEqual(["limit", [5]]);
  });

  it("falha isolada (RLS) vira lista vazia sem derrubar as outras", async () => {
    const negado = { error: { code: "42501", message: "permission denied" } };
    for (const t of ["clientes", "projetos", "fornecedores", "leads", "propostas"]) {
      supabaseFake.respond(t, "select", negado);
    }
    supabaseFake.respond("pessoas", "select", { data: [{ id: "pe1", nome: "Bia" }] });

    const { result } = renderHook(() => useBuscaGlobal("bia"), { wrapper });
    await waitFor(() => expect(result.current.grupos).toHaveLength(1));
    expect(result.current.grupos[0]).toMatchObject({ tipo: "pessoa", label: "Pessoas" });
    expect(result.current.grupos[0].itens[0].rota).toBe("/gestao/equipe");
  });

  it("escapa curingas do LIKE e a barra antes de montar o padrão", async () => {
    const { result } = renderHook(() => useBuscaGlobal("50%_a\\b"), { wrapper });
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(supabaseFake.callsTo("clientes")[0].chain).toContainEqual(["ilike", ["nome", "%50\\%\\_a\\\\b%"]]);
    expect(supabaseFake.callsTo("propostas")[0].chain).toContainEqual(["ilike", ["titulo", "%50\\%\\_a\\\\b%"]]);
  });

  it("escaparLike não mexe em texto comum", () => {
    expect(escaparLike("Torre Alfa")).toBe("Torre Alfa");
    expect(escaparLike("%")).toBe("\\%");
    expect(escaparLike("_")).toBe("\\_");
    expect(escaparLike("\\")).toBe("\\\\");
  });

  it("nenhum resultado: sem grupos", async () => {
    const { result } = renderHook(() => useBuscaGlobal("zz"), { wrapper });
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.enabled).toBe(true);
    expect(result.current.grupos).toEqual([]);
  });
});

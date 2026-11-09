import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { sb } from "../testing/supabaseMock";
import { defaultFilters } from "../components/lancamentosFilters";

// Paginação server-side de Lançamentos (spec 033): filtros viram args da RPC,
// páginas de 100 por offset, valores numéricos normalizados.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("../testing/supabaseMock")).sb.client,
}));

import { useLancamentosPaginados } from "./useLancamentosPaginados";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const pagina = (n: number, offset = 0) =>
  Array.from({ length: n }, (_, i) => ({ id: `l${offset + i}`, valor: "10.5", grupo_total_original: null }));

beforeEach(() => {
  sb.reset();
});

describe("useLancamentosPaginados", () => {
  it("manda filtros, ordenação e página; normaliza valores", async () => {
    sb.rpcResultado("get_lancamentos_pagina", {
      data: [
        { id: "l1", valor: "1500.25", grupo_total_original: "3000" },
        { id: "l2", valor: null, grupo_total_original: null },
      ],
      error: null,
    });
    const filters = { ...defaultFilters, tipo: "despesa" as const, search: " cimento ", periodo: "tudo" as const };
    const { result } = renderHook(() => useLancamentosPaginados({ filters, sortKey: "valor", sortDir: "asc" }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([
      { id: "l1", valor: 1500.25, grupo_total_original: 3000 },
      { id: "l2", valor: 0, grupo_total_original: null },
    ]);
    expect(sb.argsRpc("get_lancamentos_pagina")).toMatchObject({
      p_tipo: "despesa",
      p_search: "cimento",
      p_sort_key: "valor",
      p_sort_dir: "asc",
      p_limit: 100,
      p_offset: 0,
    });
    expect(result.current.hasNextPage).toBe(false);
  });

  it("página cheia habilita a próxima, buscada por offset", async () => {
    sb.rpcResultado("get_lancamentos_pagina", [
      { data: pagina(100), error: null },
      { data: pagina(3, 100), error: null },
    ]);
    const { result } = renderHook(
      () => useLancamentosPaginados({ filters: defaultFilters, sortKey: "data", sortDir: "desc" }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.data).toHaveLength(103));
    expect(sb.argsRpc("get_lancamentos_pagina", 1)).toMatchObject({ p_offset: 100 });
    expect(result.current.hasNextPage).toBe(false);
  });

  it("erro da RPC é exposto e a lista fica vazia", async () => {
    sb.rpcResultado("get_lancamentos_pagina", { data: null, error: { message: "statement timeout" } });
    const { result } = renderHook(
      () => useLancamentosPaginados({ filters: defaultFilters, sortKey: "data", sortDir: "desc" }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.data).toEqual([]);
  });
});

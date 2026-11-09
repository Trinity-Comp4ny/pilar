import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { sb } from "../testing/supabaseMock";

// Resumo do plano inteiro de cada grupo de parcelas e as parcelas de todos os
// meses ao expandir o grupo (BEZ-442).

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("../testing/supabaseMock")).sb.client,
}));

import { useGruposParcelaResumo } from "./useGruposParcelaResumo";
import { useParcelasDosGrupos } from "./useParcelasDosGrupos";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  sb.reset();
});

describe("useGruposParcelaResumo", () => {
  it("sem grupos não consulta e devolve mapa vazio", () => {
    const { result } = renderHook(() => useGruposParcelaResumo([]), { wrapper });
    expect(result.current.size).toBe(0);
    expect(sb.client.rpc).not.toHaveBeenCalled();
  });

  it("dedup e ordena os ids; mapeia o resumo com defaults", async () => {
    sb.rpcResultado("get_grupos_parcela_resumo", {
      data: [
        {
          grupo_parcela: "g1",
          total_original: "3000",
          total_pago: "1000",
          saldo: "2000",
          pagas: 1,
          total_parcelas: 3,
          proxima_venc: "2026-11-10",
          proxima_valor: "1000",
          status: "parcial",
        },
        { grupo_parcela: "g2", total_original: null, proxima_valor: null, status: null },
      ],
      error: null,
    });
    const { result } = renderHook(() => useGruposParcelaResumo(["g2", "g1", "g2"]), { wrapper });
    await waitFor(() => expect(result.current.size).toBe(2));
    expect(sb.argsRpc("get_grupos_parcela_resumo")).toEqual({ p_grupo_ids: ["g1", "g2"] });
    expect(result.current.get("g1")).toEqual({
      totalOriginal: 3000,
      totalPago: 1000,
      saldo: 2000,
      pagas: 1,
      totalParcelas: 3,
      proximaVenc: "2026-11-10",
      proximaValor: 1000,
      status: "parcial",
    });
    expect(result.current.get("g2")).toMatchObject({
      totalOriginal: 0,
      proximaVenc: null,
      proximaValor: null,
      status: "aberto",
    });
  });

  it("erro da RPC devolve mapa vazio", async () => {
    sb.rpcResultado("get_grupos_parcela_resumo", { data: null, error: { message: "boom" } });
    const { result } = renderHook(() => useGruposParcelaResumo(["g1"]), { wrapper });
    await waitFor(() => expect(sb.client.rpc).toHaveBeenCalled());
    expect(result.current.size).toBe(0);
  });
});

describe("useParcelasDosGrupos", () => {
  it("sem grupos não consulta", () => {
    const { result } = renderHook(() => useParcelasDosGrupos([]), { wrapper });
    expect(result.current.size).toBe(0);
    expect(sb.client.from).not.toHaveBeenCalled();
  });

  it("agrupa as parcelas por grupo, na ordem do número, com valores numéricos", async () => {
    sb.resultado("lancamentos.select", {
      data: [
        { id: "a1", grupo_parcela: "g1", parcela_numero: 1, valor: "500", grupo_total_original: "1500" },
        { id: "b1", grupo_parcela: "g2", parcela_numero: 1, valor: null, grupo_total_original: null },
        { id: "a2", grupo_parcela: "g1", parcela_numero: 2, valor: 500, grupo_total_original: 1500 },
      ],
      error: null,
    });
    const ids = ["g2", "g1"];
    const { result } = renderHook(() => useParcelasDosGrupos(ids), { wrapper });
    await waitFor(() => expect(result.current.size).toBe(2));
    expect(sb.de("lancamentos", "in")[0].args).toEqual(["grupo_parcela", ["g1", "g2"]]);
    expect(sb.de("lancamentos", "order")[0].args).toEqual(["parcela_numero", { ascending: true }]);
    expect(result.current.get("g1")!.map((l) => [l.id, l.valor, l.grupo_total_original])).toEqual([
      ["a1", 500, 1500],
      ["a2", 500, 1500],
    ]);
    expect(result.current.get("g2")![0]).toMatchObject({ valor: 0, grupo_total_original: null });
  });

  it("erro da consulta devolve mapa vazio", async () => {
    sb.resultado("lancamentos.select", { data: null, error: { message: "boom" } });
    const { result } = renderHook(() => useParcelasDosGrupos(["g1"]), { wrapper });
    await waitFor(() => expect(sb.client.from).toHaveBeenCalled());
    expect(result.current.size).toBe(0);
  });
});

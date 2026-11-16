import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fake, rpcComEmpresa } from "@/pages/obras/testing/supabaseFake";

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));

import {
  agruparPlanejamentoManual,
  useObraPlanejamentoMes,
  useSalvarPlanejamentoNo,
  useVoltarAoAutomatico,
  type ObraPlanejamentoMesRow,
} from "./useObraPlanejamentoMes";

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidar = vi.spyOn(qc, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { invalidar, wrapper };
}

const linha = (frente: string, mes: string, percentual: number): ObraPlanejamentoMesRow => ({
  id: `${frente}-${mes}`,
  empresa_id: "emp-1",
  obra_id: "o-1",
  obra_frente_id: frente,
  mes,
  percentual,
  created_at: "2026-11-01",
  updated_at: "2026-11-01",
});

beforeEach(() => {
  vi.clearAllMocks();
  fake.reset();
  rpcComEmpresa();
});

describe("agruparPlanejamentoManual", () => {
  it("agrupa por nó e troca a data do banco pela chave do mês", () => {
    const r = agruparPlanejamentoManual([
      linha("s1", "2026-11-01", 51.6129),
      linha("s1", "2026-12-01", 48.3871),
      linha("s2", "2026-11-01", 100),
    ]);
    expect(r.get("s1")).toEqual({ "2026-11": 51.6129, "2026-12": 48.3871 });
    expect(r.get("s2")).toEqual({ "2026-11": 100 });
  });

  it("converte percentual que vem como texto do banco", () => {
    const r = agruparPlanejamentoManual([{ ...linha("s1", "2026-11-01", 0), percentual: "37.5" as unknown as number }]);
    expect(r.get("s1")).toEqual({ "2026-11": 37.5 });
  });
});

describe("useObraPlanejamentoMes", () => {
  it("lê as células da obra", async () => {
    fake.responder((c) => (c.tabela === "obra_planejamento_mes" ? { data: [linha("s1", "2026-11-01", 100)], error: null } : undefined));
    const m = montar();
    const { result } = renderHook(() => useObraPlanejamentoMes("o-1"), { wrapper: m.wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    const c = fake.chamadas.find((x) => x.tabela === "obra_planejamento_mes")!;
    expect(c.filtros).toContainEqual(["eq", "obra_id", "o-1"]);
  });

  it("não consulta sem obra", () => {
    const m = montar();
    renderHook(() => useObraPlanejamentoMes(undefined), { wrapper: m.wrapper });
    expect(fake.chamadas).toHaveLength(0);
  });

  it("propaga erro de servidor", async () => {
    fake.responder(() => ({ data: null, error: { message: "falhou" } }));
    const m = montar();
    const { result } = renderHook(() => useObraPlanejamentoMes("o-1"), { wrapper: m.wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useSalvarPlanejamentoNo", () => {
  it("grava todos os meses do nó de uma vez e remove os que sobraram", async () => {
    const m = montar();
    const { result } = renderHook(() => useSalvarPlanejamentoNo("o-1"), { wrapper: m.wrapper });
    await act(async () => {
      await result.current.mutateAsync({ obraFrenteId: "s1", percentuais: { "2026-11": 40, "2026-12": 60 } });
    });

    const [upsert, limpeza] = fake.escritas("obra_planejamento_mes");
    expect(upsert.op).toBe("upsert");
    expect(upsert.payload).toEqual([
      { empresa_id: "emp-1", obra_id: "o-1", obra_frente_id: "s1", mes: "2026-11-01", percentual: 40 },
      { empresa_id: "emp-1", obra_id: "o-1", obra_frente_id: "s1", mes: "2026-12-01", percentual: 60 },
    ]);
    expect(limpeza.op).toBe("delete");
    expect(limpeza.filtros).toContainEqual(["eq", "obra_frente_id", "s1"]);
    expect(limpeza.filtros).toContainEqual(["not", "mes", "in", "(2026-11-01,2026-12-01)"]);
    expect(m.invalidar).toHaveBeenCalledWith({ queryKey: ["obra_planejamento_mes", "o-1"] });
  });

  it("recusa percentual fora de 0 a 100 sem tocar no banco", async () => {
    const m = montar();
    const { result } = renderHook(() => useSalvarPlanejamentoNo("o-1"), { wrapper: m.wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ obraFrenteId: "s1", percentuais: { "2026-11": 101 } })).rejects.toThrow(
        "0 a 100"
      );
      await expect(result.current.mutateAsync({ obraFrenteId: "s1", percentuais: { "2026-11": -1 } })).rejects.toThrow();
      await expect(result.current.mutateAsync({ obraFrenteId: "s1", percentuais: { "2026-11": Number.NaN } })).rejects.toThrow();
    });
    expect(fake.escritas()).toHaveLength(0);
  });

  it("recusa mês mal formado e nó sem nenhum mês", async () => {
    const m = montar();
    const { result } = renderHook(() => useSalvarPlanejamentoNo("o-1"), { wrapper: m.wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ obraFrenteId: "s1", percentuais: { "2026-13": 10 } })).rejects.toThrow(
        "Mês inválido"
      );
      await expect(result.current.mutateAsync({ obraFrenteId: "s1", percentuais: {} })).rejects.toThrow("ao menos um mês");
    });
    expect(fake.escritas()).toHaveLength(0);
  });

  it("falha sem empresa vinculada", async () => {
    fake.rpc.mockImplementation(async () => ({ data: null, error: null }));
    const m = montar();
    const { result } = renderHook(() => useSalvarPlanejamentoNo("o-1"), { wrapper: m.wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ obraFrenteId: "s1", percentuais: { "2026-11": 100 } })).rejects.toThrow(
        "empresa"
      );
    });
    expect(fake.escritas()).toHaveLength(0);
  });

  it("propaga erro de RLS do upsert e não limpa nem invalida", async () => {
    fake.responder((c) => (c.op === "upsert" ? { data: null, error: { message: "violates row-level security" } } : undefined));
    const m = montar();
    const { result } = renderHook(() => useSalvarPlanejamentoNo("o-1"), { wrapper: m.wrapper });
    await act(async () => {
      await expect(
        result.current.mutateAsync({ obraFrenteId: "s1", percentuais: { "2026-11": 100 } })
      ).rejects.toMatchObject({ message: "violates row-level security" });
    });
    expect(fake.escritas("obra_planejamento_mes")).toHaveLength(1);
    expect(m.invalidar).not.toHaveBeenCalled();
  });
});

describe("useVoltarAoAutomatico", () => {
  it("apaga as células do nó naquela obra", async () => {
    const m = montar();
    const { result } = renderHook(() => useVoltarAoAutomatico("o-1"), { wrapper: m.wrapper });
    await act(async () => {
      await result.current.mutateAsync("s1");
    });
    const [del] = fake.escritas("obra_planejamento_mes");
    expect(del.op).toBe("delete");
    expect(del.filtros).toEqual([
      ["eq", "obra_id", "o-1"],
      ["eq", "obra_frente_id", "s1"],
    ]);
    expect(m.invalidar).toHaveBeenCalledWith({ queryKey: ["obra_planejamento_mes", "o-1"] });
  });

  it("propaga erro", async () => {
    fake.responder((c) => (c.op === "delete" ? { data: null, error: { message: "negado" } } : undefined));
    const m = montar();
    const { result } = renderHook(() => useVoltarAoAutomatico("o-1"), { wrapper: m.wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync("s1")).rejects.toMatchObject({ message: "negado" });
    });
  });
});

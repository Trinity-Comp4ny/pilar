import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { sb } from "@/pages/financeiro/testing/supabaseMock";

// SPEC 168: parâmetros comerciais da empresa (imposto, margens, meios de recebimento).

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/financeiro/testing/supabaseMock")).sb.client,
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ profile: { empresa_id: "e1" } }) }));

import { CONFIG_COMERCIAL_PADRAO, useConfigComercial, useSalvarConfigComercial } from "./useConfigComercial";

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  sb.reset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});

describe("useConfigComercial", () => {
  it("sem linha gravada devolve o padrão", async () => {
    sb.resultado("empresa_config_comercial.select", { data: null, error: null });
    const { result } = renderHook(() => useConfigComercial(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(CONFIG_COMERCIAL_PADRAO);
  });

  it("lê a configuração e normaliza os meios, descartando itens inválidos", async () => {
    sb.resultado("empresa_config_comercial.select", {
      data: {
        aliquota_imposto_pct: "6",
        margem_minima_pct: "10",
        margem_alvo_pct: "25",
        meios_recebimento: [
          { id: "cartao", nome: "Cartão", taxa_pct: "3.5", faixas: { "1": "2", "2": 4 } },
          { id: "pix", nome: "PIX", taxa_pct: 0 },
          { nome: "sem id" },
          "lixo",
        ],
      },
      error: null,
    });
    const { result } = renderHook(() => useConfigComercial(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      aliquotaImpostoPct: 6,
      margemMinimaPct: 10,
      margemAlvoPct: 25,
      meiosRecebimento: [
        { id: "cartao", nome: "Cartão", taxa_pct: 3.5, faixas: { "1": 2, "2": 4 } },
        { id: "pix", nome: "PIX", taxa_pct: 0 },
      ],
    });
  });

  it("sem meios válidos usa os meios padrão", async () => {
    sb.resultado("empresa_config_comercial.select", {
      data: { aliquota_imposto_pct: 0, margem_minima_pct: 15, margem_alvo_pct: 30, meios_recebimento: "x" },
      error: null,
    });
    const { result } = renderHook(() => useConfigComercial(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.meiosRecebimento).toEqual(CONFIG_COMERCIAL_PADRAO.meiosRecebimento);
  });

  it("propaga erro de leitura e não consulta quando desabilitado", async () => {
    sb.resultado("empresa_config_comercial.select", { data: null, error: { message: "boom" } });
    const { result } = renderHook(() => useConfigComercial(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    sb.chamadas.length = 0;
    renderHook(() => useConfigComercial(false), { wrapper });
    expect(sb.chamadas).toHaveLength(0);
  });
});

describe("useSalvarConfigComercial", () => {
  it("faz upsert com a empresa do usuário", async () => {
    sb.resultado("empresa_config_comercial.upsert", { data: null, error: null });
    const { result } = renderHook(() => useSalvarConfigComercial(), { wrapper });
    await result.current.mutateAsync({ ...CONFIG_COMERCIAL_PADRAO, aliquotaImpostoPct: 6 });
    const up = sb.chamadas.find((c) => c.metodo === "upsert");
    expect(up?.args[0]).toMatchObject({ empresa_id: "e1", aliquota_imposto_pct: 6, margem_alvo_pct: 30 });
  });

  it("propaga erro do upsert", async () => {
    sb.resultado("empresa_config_comercial.upsert", { data: null, error: { message: "negado" } });
    const { result } = renderHook(() => useSalvarConfigComercial(), { wrapper });
    await expect(result.current.mutateAsync(CONFIG_COMERCIAL_PADRAO)).rejects.toBeTruthy();
  });
});

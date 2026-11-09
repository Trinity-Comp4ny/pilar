import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

const rpc = vi.fn();
const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a), functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));
vi.mock("@/lib/analytics", () => ({ analytics: { track: vi.fn() } }));

import { useResumoSemanal } from "./useResumoSemanal";

const conteudo = {
  manchete: "Semana com 3 projetos atrasados",
  destaques: [{ tom: "atencao", texto: "3 projetos atrasados" }],
};

const semResumo = { escopo: "empresa", semana_inicio: "2026-10-12", resumo: null };
const comResumo = {
  escopo: "empresa",
  semana_inicio: "2026-10-12",
  resumo: { conteudo, gerado_em: "2026-10-15T12:00:00Z" },
};

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  rpc.mockReset();
  invoke.mockReset();
});

describe("useResumoSemanal", () => {
  it("com resumo da semana, lê e não chama a função de geração", async () => {
    rpc.mockResolvedValue({ data: comResumo, error: null });
    const { result } = renderHook(() => useResumoSemanal(true), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.estado).toBe("pronto"));
    expect(result.current.resumo?.conteudo.manchete).toBe("Semana com 3 projetos atrasados");
    expect(result.current.resumo?.origem).toBe("ia");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("sem resumo, pede a geração UMA vez e mostra o texto devolvido", async () => {
    rpc.mockResolvedValue({ data: semResumo, error: null });
    invoke.mockResolvedValue({
      data: { escopo: "empresa", resumo: conteudo, origem: "ia", gerado_em: "2026-10-15T12:00:00Z" },
      error: null,
    });
    const { result } = renderHook(() => useResumoSemanal(true), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.resumo?.origem).toBe("ia"));
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("resumo-semanal", { body: {} });
  });

  it("função devolve resumo automático: mostra com o motivo e não pede de novo", async () => {
    rpc.mockResolvedValue({ data: semResumo, error: null });
    invoke.mockResolvedValue({
      data: { escopo: "empresa", resumo: conteudo, origem: "automatico", motivo: "Os tokens de IA acabaram." },
      error: null,
    });
    const { result } = renderHook(() => useResumoSemanal(true), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.resumo?.origem).toBe("automatico"));
    expect(result.current.resumo?.motivo).toBe("Os tokens de IA acabaram.");
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("resposta fora do formato falha cedo, vira erro e deixa tentar de novo", async () => {
    rpc.mockResolvedValue({ data: semResumo, error: null });
    invoke.mockResolvedValue({ data: { escopo: "empresa", resumo: { manchete: 1 } }, error: null });
    const { result } = renderHook(() => useResumoSemanal(true), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.estado).toBe("erro"));
    expect(result.current.resumo).toBeNull();
  });
});

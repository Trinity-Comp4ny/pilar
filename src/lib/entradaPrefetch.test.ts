import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

vi.mock("@/pages/inicio/hooks/usePainelGestao", () => ({ fetchPainelGestao: vi.fn() }));
import { prefetchDaRota } from "./entradaPrefetch";

describe("prefetchDaRota /inicio", () => {
  it("prefetcha o painel com a mesma chave do hook (empresa e usuário)", async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "prefetchQuery").mockResolvedValue(undefined);
    await Promise.all(prefetchDaRota(qc, "/inicio", { empresaId: "e1", usuarioId: "u1" }));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["painel-gestao", "e1", "u1"] }));
  });
});

describe("prefetchDaRota /obras e /clientes", () => {
  it("usa as chaves das listas iniciais", async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "prefetchQuery").mockResolvedValue(undefined);
    const ctx = { empresaId: "e1", usuarioId: "u1" };
    await Promise.all(prefetchDaRota(qc, "/obras", ctx));
    await Promise.all(prefetchDaRota(qc, "/clientes", ctx));
    const chaves = spy.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));
    expect(chaves[0]).toBe('["obras","lista"]');
    expect(chaves[1]).toContain('"clientes","lista"');
    expect(chaves[1]).toContain('"sortField":"nome"');
  });
});

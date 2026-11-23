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

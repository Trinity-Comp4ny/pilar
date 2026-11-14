import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { NpsCard } from "./NpsCard";

const h = vi.hoisted(() => ({
  minhas: vi.fn(),
  gravar: vi.fn(),
  criadaEm: "2026-01-01T00:00:00Z" as string | null,
}));
vi.mock("@/lib/pesquisasApi", () => ({ minhasRespostas: h.minhas, gravarResposta: h.gravar }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" }, profile: { created_at: h.criadaEm } }),
}));

async function montar(rota = "/inicio") {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[rota]}>
        <NpsCard />
      </MemoryRouter>
    </QueryClientProvider>
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(21_000);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.clearAllMocks();
  h.minhas.mockResolvedValue([]);
  h.criadaEm = "2026-01-01T00:00:00Z";
});
afterEach(() => vi.useRealTimers());

describe("NpsCard (SPEC 156)", () => {
  it("aparece no Início depois da espera, para conta com mais de 14 dias", async () => {
    await montar();
    expect(await screen.findByRole("region", { name: "Pesquisa de satisfação" })).toBeInTheDocument();
  });

  it("não aparece fora do Início nem para conta nova", async () => {
    await montar("/projetos");
    expect(screen.queryByRole("region", { name: "Pesquisa de satisfação" })).not.toBeInTheDocument();
  });

  it("não aparece se já respondeu nos últimos 90 dias", async () => {
    h.minhas.mockResolvedValue([{ tipo: "nps", fluxo: null, created_at: new Date().toISOString() }]);
    await montar();
    expect(screen.queryByRole("region", { name: "Pesquisa de satisfação" })).not.toBeInTheDocument();
  });

  it("grava a nota e o comentário; fechar grava dispensa", async () => {
    await montar();
    act(() => screen.getByRole("radio", { name: "3" }).click());
    act(() => screen.getByRole("button", { name: "Enviar" }).click());
    expect(h.gravar).toHaveBeenCalledWith({ tipo: "nps", nota: 3, comentario: "", rota: "/inicio" });
    expect(screen.getByRole("status")).toHaveTextContent("Obrigado");
  });

  it("fechar sem responder grava a dispensa", async () => {
    await montar();
    act(() => screen.getByRole("button", { name: "Agora não" }).click());
    expect(h.gravar).toHaveBeenCalledWith({ tipo: "nps", nota: null, rota: "/inicio" });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavegadoresConta } from "./NavegadoresConta";

const h = vi.hoisted(() => ({
  linhas: [] as unknown[],
  apagar: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/dispositivo", () => ({ idDoDispositivo: () => "atual" }));
vi.mock("@/integrations/supabase/client", () => {
  const leitura = {
    select: () => leitura,
    eq: () => leitura,
    order: () => Promise.resolve({ data: h.linhas, error: null }),
  };
  const apagar = {
    eq: () => apagar,
    then: (ok: (v: unknown) => void) => {
      h.apagar();
      ok({ error: null });
    },
  };
  return { supabase: { from: () => ({ ...leitura, delete: () => apagar }) } };
});

beforeEach(() => vi.clearAllMocks());

describe("NavegadoresConta (SPEC 159)", () => {
  it("lista os navegadores, marca este e esquece outro", async () => {
    h.linhas = [
      {
        dispositivo_id: "atual",
        descricao: "Chrome no Windows",
        primeiro_em: "2026-11-01T10:00:00Z",
        ultimo_em: "2026-11-10T10:00:00Z",
      },
      {
        dispositivo_id: "outro",
        descricao: "Safari no iPhone",
        primeiro_em: "2026-11-05T10:00:00Z",
        ultimo_em: "2026-11-06T10:00:00Z",
      },
    ];
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NavegadoresConta />
      </QueryClientProvider>
    );
    expect(await screen.findByText("Safari no iPhone")).toBeInTheDocument();
    expect(screen.getByText("Este navegador")).toBeInTheDocument();
    const botoes = screen.getAllByRole("button", { name: "Esquecer" });
    expect(botoes).toHaveLength(1);
    await userEvent.setup().click(botoes[0]);
    await waitFor(() => expect(h.apagar).toHaveBeenCalled());
  });
});

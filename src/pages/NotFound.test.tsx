import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import NotFound from "./NotFound";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession } } }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/anterior", "/rota/que/nao/existe"]} initialIndex={1}>
      <Routes>
        <Route path="/anterior" element={<div data-testid="anterior">Anterior</div>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NotFound", () => {
  it("visitante: mostra o caminho, leva ao início público e oferece login", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    renderPage();
    expect(await screen.findByText("Página não encontrada")).toBeInTheDocument();
    expect(screen.getByText("/rota/que/nao/existe")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ir para o início/ })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Ir para login" })).toHaveAttribute("href", "/login");
  });

  it("logado: botão principal leva ao dashboard e não sugere login", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "u" } } } });
    renderPage();
    expect(await screen.findByRole("link", { name: /Ir para o Dashboard/ })).toHaveAttribute("href", "/inicio");
    expect(screen.queryByRole("link", { name: "Ir para login" })).not.toBeInTheDocument();
  });

  it("Página anterior volta no histórico", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    renderPage();
    await userEvent.setup().click(await screen.findByRole("button", { name: /Página anterior/ }));
    expect(await screen.findByTestId("anterior")).toBeInTheDocument();
  });
});

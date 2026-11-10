import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Layout from "./Layout";

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/components/AppSidebar", () => ({ AppSidebar: () => <nav data-testid="sidebar" /> }));
vi.mock("@/components/BottomNav", () => ({ BottomNav: () => <nav data-testid="bottom-nav" /> }));
vi.mock("@/components/motion/useRouteEnter", () => ({ useRouteEnter: vi.fn() }));
vi.mock("@/contexts/AvatarDiretorioContext", () => ({
  AvatarDiretorioProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/CommandPalette", () => ({
  CommandPalette: ({ open }: { open: boolean }) => (open ? <div data-testid="paleta" /> : null),
}));
vi.mock("@/components/AtalhosTecladoDialog", () => ({
  AtalhosTecladoDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="atalhos" /> : null),
}));
vi.mock("@/components/OnboardingChecklist", () => ({ OnboardingChecklist: () => <div data-testid="checklist" /> }));
vi.mock("@/components/onboarding/OnboardingTourController", () => ({ OnboardingTourController: () => null }));
vi.mock("@/components/novidades/OQueMudou", () => ({ OQueMudou: () => null }));
vi.mock("@/components/FaixaAvisos", () => ({ FaixaAvisos: () => null }));
vi.mock("@/components/agente/AgenteAjuda", () => ({ AgenteAjuda: () => null }));
vi.mock("@/components/pesquisas/NpsCard", () => ({ NpsCard: () => null }));
vi.mock("@/lib/monitoring", () => ({ monitoring: { captureException: vi.fn(), addBreadcrumb: vi.fn() } }));

function renderLayout(rota = "/inicio") {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/inicio" element={<h1>Página início</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("Layout", () => {
  it("monta shell com skip link, main focável, sidebar e conteúdo da rota", async () => {
    renderLayout();
    expect(screen.getByRole("link", { name: "Pular para conteúdo principal" })).toHaveAttribute(
      "href",
      "#main-content"
    );
    expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("bottom-nav")).toBeInTheDocument();
    expect(screen.getByText("Página início")).toBeInTheDocument();
    expect(await screen.findByTestId("checklist")).toBeInTheDocument();
    expect(screen.getByText(/para comandos/)).toBeInTheDocument();
  });

  it("⌘K abre a paleta sob demanda", async () => {
    renderLayout();
    expect(screen.queryByTestId("paleta")).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.keyDown(window, { key: "k", metaKey: true });
    });
    expect(await screen.findByTestId("paleta")).toBeInTheDocument();
  });

  it("? abre o painel de atalhos sob demanda, mas não enquanto digita num campo", async () => {
    renderLayout();
    const campo = document.createElement("input");
    document.body.appendChild(campo);
    campo.focus();
    await act(async () => {
      fireEvent.keyDown(window, { key: "?", shiftKey: true });
    });
    expect(screen.queryByTestId("atalhos")).not.toBeInTheDocument();

    campo.blur();
    campo.remove();
    await act(async () => {
      fireEvent.keyDown(window, { key: "?", shiftKey: true });
    });
    expect(await screen.findByTestId("atalhos")).toBeInTheDocument();
  });

  it("?boom em dev mostra a tela de erro dentro do shell", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    window.history.replaceState(null, "", "/?boom");
    renderLayout();
    expect(screen.getByText("Esta página não carregou")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });
});

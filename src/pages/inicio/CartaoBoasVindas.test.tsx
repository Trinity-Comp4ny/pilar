import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CartaoBoasVindas } from "./CartaoBoasVindas";
import { ONBOARDING_STEPS, ordemDosPilares } from "@/lib/onboarding/steps";
import { deriveProgress, filterVisibleSteps } from "@/lib/onboarding/progress";
import { EMPTY_ONBOARDING_STATE, type OnboardingState } from "@/lib/onboarding/state";
import type { Objetivo } from "@/lib/perfilEscritorio";

const h = vi.hoisted(() => ({
  objetivo: null as string | null,
  state: {} as OnboardingState,
  counts: {} as Record<string, number>,
  dispensar: vi.fn(),
  track: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    profile: { first_name: "Ana", empresas: { nome: "Alfa Engenharia", objetivo_inicial: h.objetivo } },
  }),
}));
vi.mock("@/hooks/useOnboardingState", () => ({
  useOnboardingState: () => ({ state: h.state, dispensarBoasVindas: h.dispensar }),
}));
vi.mock("@/hooks/useOnboardingProgress", () => ({
  useOnboardingProgress: () => ({
    ...deriveProgress(
      filterVisibleSteps(ONBOARDING_STEPS, () => true, true),
      { counts: h.counts },
      ordemDosPilares(h.objetivo as Objetivo | null)
    ),
    loading: false,
    hasEmpresa: true,
  }),
}));
vi.mock("@/lib/analytics", () => ({ analytics: { track: h.track } }));

function renderCartao() {
  return render(
    <MemoryRouter initialEntries={["/inicio"]}>
      <Routes>
        <Route path="/inicio" element={<CartaoBoasVindas />} />
        <Route path="/obras" element={<div data-testid="obras" />} />
        <Route path="/gestao/clientes" element={<div data-testid="clientes" />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.objetivo = null;
  h.state = { ...EMPTY_ONBOARDING_STATE };
  h.counts = {};
});

describe("CartaoBoasVindas", () => {
  it("mostra os três pilares com o primeiro passo de cada um", () => {
    renderCartao();
    expect(screen.getByRole("heading", { name: "Boas-vindas ao Pilar, Ana." })).toBeInTheDocument();
    const cartoes = screen.getAllByRole("button").filter((b) => b.getAttribute("aria-label") !== "Fechar boas-vindas");
    expect(cartoes.map((c) => c.textContent)).toEqual([
      expect.stringContaining("Cadastre um cliente"),
      expect.stringContaining("Abra seu primeiro projeto"),
      expect.stringContaining("Cadastre uma obra"),
    ]);
  });

  it("o pilar escolhido vem primeiro, marcado, e leva ao primeiro passo dele", async () => {
    h.objetivo = "obras";
    renderCartao();
    expect(screen.getByText("Sua escolha")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /Obras/ }));
    expect(await screen.findByTestId("obras")).toBeInTheDocument();
    expect(h.track).toHaveBeenCalledWith("onboarding_boas_vindas_acao", { pilar: "obras", escolhido: true });
  });

  it("fechar grava a dispensa", async () => {
    renderCartao();
    await userEvent.setup().click(screen.getByRole("button", { name: "Fechar boas-vindas" }));
    expect(h.dispensar).toHaveBeenCalled();
  });

  it("some depois de fechado ou com os primeiros passos concluídos", () => {
    h.state = { ...EMPTY_ONBOARDING_STATE, boas_vindas_dispensada: true };
    const { container, unmount } = renderCartao();
    expect(container).toBeEmptyDOMElement();
    unmount();
    h.state = { ...EMPTY_ONBOARDING_STATE, completed_at: "2026-11-07T10:00:00Z" };
    expect(renderCartao().container).toBeEmptyDOMElement();
  });
});

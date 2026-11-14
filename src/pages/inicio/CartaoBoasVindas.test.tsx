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
  respostas: {
    dores: [],
    dorPrincipal: null,
    textoLivre: "",
    contexto: {},
    etapaAtual: 1,
    concluidoEm: null,
  } as Record<string, unknown>,
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
vi.mock("@/hooks/useOnboardingRespostas", () => ({
  useOnboardingRespostas: () => ({ respostas: h.respostas, carregando: false, salvar: vi.fn() }),
}));
vi.mock("@/lib/analytics", () => ({ analytics: { track: h.track } }));

function renderCartao() {
  return render(
    <MemoryRouter initialEntries={["/inicio"]}>
      <Routes>
        <Route path="/inicio" element={<CartaoBoasVindas />} />
        <Route path="/obras" element={<div data-testid="obras" />} />
        <Route path="/gestao/clientes" element={<div data-testid="clientes" />} />
        <Route path="/gestao/equipe" element={<div data-testid="equipe" />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.objetivo = null;
  h.state = { ...EMPTY_ONBOARDING_STATE };
  h.counts = {};
  h.respostas = { dores: [], dorPrincipal: null, textoLivre: "", contexto: {}, etapaAtual: 1, concluidoEm: null };
});

describe("CartaoBoasVindas", () => {
  it("mostra os três pilares com o primeiro passo de cada um", () => {
    renderCartao();
    expect(screen.getByRole("heading", { name: "Boas-vindas à Pilar, Ana." })).toBeInTheDocument();
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

  describe("plano de quem concluiu o onboarding (SPEC 165)", () => {
    beforeEach(() => {
      h.respostas = {
        dores: ["prazos"],
        dorPrincipal: "prazos",
        textoLivre: "",
        contexto: {},
        etapaAtual: 7,
        concluidoEm: "2026-11-13T12:00:00Z",
      };
    });

    it("troca os três pilares pelos passos da dor, na ordem de dependência", () => {
      renderCartao();
      expect(screen.getByText(/Seu plano:/)).toBeInTheDocument();
      expect(screen.getByText(/Montamos seu plano com o que você nos contou/)).toBeInTheDocument();
      expect(screen.queryByText(/Escolha um pilar/)).not.toBeInTheDocument();
      const itens = screen.getAllByRole("listitem").map((li) => li.textContent ?? "");
      expect(itens[0]).toContain("Cadastre um cliente");
      expect(itens.findIndex((t) => t.includes("Cadastre sua equipe"))).toBeLessThan(
        itens.findIndex((t) => t.includes("Abra seu primeiro projeto"))
      );
      expect(screen.queryByRole("button", { name: /Gestão/ })).not.toBeInTheDocument();
    });

    it("passo bloqueado diz o que falta e o toque vai ao pré-requisito", async () => {
      renderCartao();
      const projeto = screen.getByRole("button", { name: /Abra seu primeiro projeto/ });
      expect(projeto).toHaveTextContent(/Antes: cadastre um cliente; cadastre sua equipe/i);
      await userEvent.setup().click(projeto);
      expect(await screen.findByTestId("clientes")).toBeInTheDocument();
      expect(h.track).toHaveBeenCalledWith("onboarding_boas_vindas_acao", { passo: "projeto" });
    });

    it("passo feito fica marcado e não é clicável", () => {
      h.counts = { clientes: 1 };
      renderCartao();
      expect(screen.getByRole("button", { name: /Cadastre um cliente/ })).toBeDisabled();
      expect(screen.getByRole("button", { name: /Abra seu primeiro projeto/ })).toHaveTextContent(
        /Antes: cadastre sua equipe/i
      );
    });

    it("sem onboarding concluído, segue mostrando os três pilares", () => {
      h.respostas = { ...h.respostas, concluidoEm: null };
      renderCartao();
      expect(screen.queryByText(/Seu plano:/)).not.toBeInTheDocument();
      expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(3);
    });
  });
});

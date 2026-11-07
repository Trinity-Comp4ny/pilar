import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingChecklist } from "./OnboardingChecklist";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  isAdmin: true,
  progress: {} as Record<string, unknown>,
  state: { dismissed: false, completed_at: null as string | null },
  dismiss: vi.fn(),
  setCompleted: vi.fn(),
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => h.navigate }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ isAdmin: h.isAdmin }) }));
vi.mock("@/hooks/useOnboardingProgress", () => ({ useOnboardingProgress: () => h.progress }));
vi.mock("@/hooks/useOnboardingState", () => ({
  useOnboardingState: () => ({ state: h.state, dismiss: h.dismiss, setCompleted: h.setCompleted }),
}));

const SECOES = [
  {
    pilar: "gestao",
    label: "Gestão",
    done: 1,
    total: 2,
    steps: [
      {
        key: "cliente",
        titulo: "Cadastrar cliente",
        descricao: "Primeiro cliente",
        rota: "/gestao/clientes",
        done: true,
      },
      {
        key: "convite",
        titulo: "Convidar equipe",
        descricao: "Traga o time",
        rota: "/gestao/equipe",
        done: false,
        opcional: true,
      },
    ],
  },
  {
    pilar: "projetos",
    label: "Projetos",
    done: 1,
    total: 1,
    steps: [{ key: "proj", titulo: "Criar projeto", descricao: "d", rota: "/projetos", done: true }],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  h.isAdmin = true;
  h.state = { dismissed: false, completed_at: null };
  h.progress = {
    hasEmpresa: true,
    loading: false,
    sections: SECOES,
    doneSteps: 2,
    totalSteps: 3,
    percent: 67,
    allDone: false,
  };
});

describe("OnboardingChecklist", () => {
  it.each([
    ["não-admin", () => (h.isAdmin = false)],
    ["sem empresa", () => (h.progress.hasEmpresa = false)],
    ["carregando", () => (h.progress.loading = true)],
    ["dispensado", () => (h.state.dismissed = true)],
    ["sem seções", () => (h.progress.sections = [])],
  ])("%s não mostra nada", (_nome, preparar) => {
    preparar();
    const { container } = render(<OnboardingChecklist />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra progresso, passos e navega no passo pendente", async () => {
    const user = userEvent.setup();
    render(<OnboardingChecklist />);
    expect(screen.getByText(/2 de 3 concluídos · 67%/)).toBeInTheDocument();
    expect(screen.getByText("opcional")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cadastrar cliente/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Convidar equipe/ }));
    expect(h.navigate).toHaveBeenCalledWith("/gestao/equipe");
  });

  it("singular quando só um passo foi concluído", () => {
    h.progress.doneSteps = 1;
    render(<OnboardingChecklist />);
    expect(screen.getByText(/1 de 3 concluído ·/)).toBeInTheDocument();
  });

  it("seção recolhe e expande", async () => {
    const user = userEvent.setup();
    render(<OnboardingChecklist />);
    await user.click(screen.getByRole("button", { name: /Gestão/ }));
    expect(screen.queryByText("Convidar equipe")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Gestão/ }));
    expect(screen.getByText("Convidar equipe")).toBeInTheDocument();
  });

  it("minimiza para a pílula e reabre", async () => {
    const user = userEvent.setup();
    render(<OnboardingChecklist />);
    await user.click(screen.getByRole("button", { name: "Minimizar" }));
    const pilula = screen.getByRole("button", { name: /Primeiros passos/ });
    expect(pilula).toHaveTextContent("2/3");
    await user.click(pilula);
    expect(screen.getByRole("button", { name: "Dispensar" })).toBeInTheDocument();
  });

  it("dispensar grava no banco", async () => {
    render(<OnboardingChecklist />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Dispensar" }));
    expect(h.dismiss).toHaveBeenCalled();
  });

  it("tudo feito: marca concluído uma vez e mostra o card final", async () => {
    h.progress = { ...h.progress, allDone: true, doneSteps: 3, percent: 100 };
    const { rerender } = render(<OnboardingChecklist />);
    expect(screen.getByText("Setup concluído")).toBeInTheDocument();
    expect(h.setCompleted).toHaveBeenCalledTimes(1);
    await userEvent.setup().click(screen.getByRole("button", { name: "Ok" }));
    expect(h.dismiss).toHaveBeenCalled();

    h.state = { dismissed: false, completed_at: "2026-11-01" };
    rerender(<OnboardingChecklist />);
    expect(h.setCompleted).toHaveBeenCalledTimes(1);
  });
});

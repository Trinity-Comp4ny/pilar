import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { OnboardingTourController } from "./OnboardingTourController";

const h = vi.hoisted(() => ({
  isAdmin: true,
  loading: false,
  steps: [] as {
    key: string;
    rota: string;
    done: boolean;
    bloqueadoPor: unknown[];
    tour?: { selector: string; titulo: string; texto: string };
  }[],
  state: { dismissed: false, tours_seen: [] as string[] },
  markTourSeen: vi.fn(),
  startStepTour: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ isAdmin: h.isAdmin }) }));
vi.mock("@/hooks/useOnboardingProgress", () => ({
  useOnboardingProgress: () => ({ steps: h.steps, loading: h.loading }),
}));
vi.mock("@/hooks/useOnboardingState", () => ({
  useOnboardingState: () => ({ state: h.state, markTourSeen: h.markTourSeen }),
}));
vi.mock("@/lib/onboarding/tour", () => ({ startStepTour: h.startStepTour }));

function montar(rota = "/projetos") {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <OnboardingTourController />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  h.isAdmin = true;
  h.loading = false;
  h.state = { dismissed: false, tours_seen: [] };
  const tour = { selector: "onb-novo-projeto", titulo: "Crie", texto: "Clique aqui" };
  h.steps = [
    { key: "feito", rota: "/projetos", done: true, bloqueadoPor: [], tour },
    { key: "projeto", rota: "/projetos", done: false, bloqueadoPor: [], tour },
  ];
  h.startStepTour.mockReturnValue({ destroy: h.destroy });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("OnboardingTourController", () => {
  it("dispara o tour do passo pendente da rota depois da tela montar", () => {
    const { unmount } = montar();
    expect(h.startStepTour).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(700));
    expect(h.startStepTour).toHaveBeenCalledWith(expect.objectContaining({ key: "projeto" }), expect.any(Function));
    h.startStepTour.mock.calls[0][1]();
    expect(h.markTourSeen).toHaveBeenCalledWith("projeto");
    unmount();
    expect(h.destroy).toHaveBeenCalled();
  });

  it("sair antes do atraso cancela o tour", () => {
    const { unmount } = montar();
    unmount();
    act(() => vi.advanceTimersByTime(1000));
    expect(h.startStepTour).not.toHaveBeenCalled();
  });

  it("convidado (não admin) também recebe o tour (SPEC 149)", () => {
    h.isAdmin = false;
    montar();
    act(() => vi.advanceTimersByTime(700));
    expect(h.startStepTour).toHaveBeenCalledWith(expect.objectContaining({ key: "projeto" }), expect.any(Function));
  });

  it.each([
    ["passo sem tour", () => (h.steps = h.steps.map((s) => ({ ...s, tour: undefined })))],
    ["carregando", () => (h.loading = true)],
    ["dispensado", () => (h.state.dismissed = true)],
    ["tour já visto", () => (h.state.tours_seen = ["projeto"])],
  ])("%s: não dispara", (_n, preparar) => {
    preparar();
    montar();
    act(() => vi.advanceTimersByTime(1000));
    expect(h.startStepTour).not.toHaveBeenCalled();
  });

  it("rota sem passo não dispara", () => {
    montar("/outra");
    act(() => vi.advanceTimersByTime(1000));
    expect(h.startStepTour).not.toHaveBeenCalled();
  });

  it("passo bloqueado não dispara o tour (SPEC 165)", () => {
    const tour = { selector: "onb-novo-projeto", titulo: "Crie", texto: "Clique aqui" };
    h.steps = [{ key: "projeto", rota: "/projetos", done: false, bloqueadoPor: [{ key: "cliente" }], tour }];
    const { unmount } = montar();
    act(() => vi.advanceTimersByTime(1000));
    expect(h.startStepTour).not.toHaveBeenCalled();
    unmount();
  });
});

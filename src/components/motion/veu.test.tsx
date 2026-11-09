import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { EntryVeil, VeilExit } from "./EntryVeil";
import { bootIsShowing, dismissBoot, setBootCaption } from "./boot";
import { isEntryVeilMounted, isOwnVeilShowing } from "./veilState";

vi.mock("./ReadingRing", () => ({ ReadingRing: () => <div data-testid="anel" /> }));

function montarBoot() {
  document.body.insertAdjacentHTML("beforeend", '<div id="boot"><p id="boot-caption">Carregando</p></div>');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.getElementById("boot")?.remove();
  delete window.__pilarBootStop;
});

describe("boot", () => {
  it("sem boot na página nada acontece", () => {
    expect(bootIsShowing()).toBe(false);
    setBootCaption("x");
    expect(() => dismissBoot()).not.toThrow();
  });

  it("troca a legenda e sai com fade uma vez só", () => {
    montarBoot();
    const stop = vi.fn();
    window.__pilarBootStop = stop;
    expect(bootIsShowing()).toBe(true);
    setBootCaption("Abrindo Seed");
    expect(document.getElementById("boot-caption")).toHaveTextContent("Abrindo Seed");

    dismissBoot();
    expect(bootIsShowing()).toBe(false);
    expect(document.getElementById("boot")!.style.opacity).toBe("0");
    dismissBoot();
    vi.advanceTimersByTime(400);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(document.getElementById("boot")).toBeNull();
  });
});

describe("EntryVeil", () => {
  it("sem boot monta o próprio véu e a saída cobre o app", () => {
    const { unmount } = render(<EntryVeil label="Abrindo Seed" />);
    expect(screen.getByTestId("anel")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Abrindo Seed");
    expect(isOwnVeilShowing()).toBe(true);

    // O Layout monta a saída antes de o véu desmontar.
    const saida = render(<VeilExit />);
    expect(saida.container.querySelector(".veil-exit")).not.toBeNull();
    unmount();
    expect(isEntryVeilMounted()).toBe(false);
    act(() => vi.advanceTimersByTime(420));
    expect(saida.container.querySelector(".veil-exit")).toBeNull();
  });

  it("com o boot na tela reaproveita o anel dele e o tira ao sair", () => {
    montarBoot();
    const { rerender, unmount } = render(<EntryVeil />);
    expect(screen.queryByTestId("anel")).not.toBeInTheDocument();
    expect(document.getElementById("boot-caption")).toHaveTextContent("Abrindo o Pilar");
    rerender(<EntryVeil label="Abrindo Seed" />);
    expect(document.getElementById("boot-caption")).toHaveTextContent("Abrindo Seed");
    expect(isOwnVeilShowing()).toBe(false);

    unmount();
    act(() => vi.advanceTimersByTime(0));
    expect(document.getElementById("boot")!.dataset.leaving).toBe("1");
  });

  it("troca de um véu por outro no mesmo commit não tira o boot", () => {
    montarBoot();
    const primeiro = render(<EntryVeil label="Sessão" />);
    const segundo = render(<EntryVeil label="Assinatura" />);
    primeiro.unmount();
    act(() => vi.advanceTimersByTime(0));
    expect(bootIsShowing()).toBe(true);
    segundo.unmount();
    act(() => vi.advanceTimersByTime(0));
    expect(bootIsShowing()).toBe(false);
  });

  it("sem véu próprio a saída não aparece", () => {
    const { container } = render(<VeilExit />);
    expect(container).toBeEmptyDOMElement();
  });
});

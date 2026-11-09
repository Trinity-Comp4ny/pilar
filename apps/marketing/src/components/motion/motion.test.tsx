import { act, render, screen } from "@testing-library/react";
import { domAnimation, LazyMotion } from "framer-motion";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prepararAmbiente } from "../../test/ambiente";

// Peças de movimento da landing: o número conta até o valor só em vista (e mostra o valor
// final direto com movimento reduzido), a faixa duplica o conteúdo para o loop sem emenda,
// e o scroll suave só intercepta a roda vertical, respeitando zoom, toque e o limite da página.

const h = vi.hoisted(() => ({ reduzido: false, emVista: false }));
vi.mock("framer-motion", async (orig) => ({
  ...(await orig<typeof import("framer-motion")>()),
  useReducedMotion: () => h.reduzido,
  useInView: () => h.emVista,
}));

import { NumberTicker } from "./NumberTicker";
import { Marquee } from "./Marquee";
import { Parallax, ScrollSettle } from "./Parallax";
import { SmoothScroll } from "../chrome/SmoothScroll";

beforeAll(() => prepararAmbiente());

let filaRaf: Array<FrameRequestCallback> = [];
let agora = 0;
function rodarQuadros(n: number, passoMs = 100) {
  for (let i = 0; i < n && filaRaf.length; i++) {
    agora += passoMs;
    const cb = filaRaf.shift()!;
    act(() => cb(agora));
  }
}

beforeEach(() => {
  h.reduzido = false;
  h.emVista = false;
  filaRaf = [];
  agora = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    filaRaf.push(cb);
    return filaRaf.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => vi.useRealTimers());

describe("NumberTicker", () => {
  it("fora de vista fica em zero, com prefixo, sufixo e casas", () => {
    render(<NumberTicker value={1234.5} decimals={1} prefix="R$ " suffix=" mil" />);
    expect(screen.getByText("R$ 0,0 mil")).toBeInTheDocument();
  });

  it("movimento reduzido mostra o valor final sem animar", () => {
    h.reduzido = true;
    render(<NumberTicker value={4200} suffix="+" />);
    expect(screen.getByText("4.200+")).toBeInTheDocument();
    expect(filaRaf).toHaveLength(0);
  });

  it("em vista conta até o valor depois do atraso e para no fim", () => {
    // Só o atraso usa relógio falso; os quadros saem da fila controlada acima.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    h.emVista = true;
    const { container, unmount } = render(<NumberTicker value={100} duration={1} delay={0.5} />);
    expect(filaRaf).toHaveLength(0);
    act(() => vi.advanceTimersByTime(500));
    rodarQuadros(1);
    const span = container.querySelector("span")!;
    expect(span.textContent).toBe("0");
    rodarQuadros(1, 500);
    const meio = Number(span.textContent);
    expect(meio).toBeGreaterThan(50);
    expect(meio).toBeLessThan(100);
    rodarQuadros(5, 500);
    expect(span.textContent).toBe("100");
    expect(filaRaf).toHaveLength(0);
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});

describe("Marquee", () => {
  it("duplica o conteúdo com a cópia escondida do leitor de tela", () => {
    render(
      <LazyMotion features={domAnimation}>
        <Marquee reverse className="faixa">
          <span>Engenharia</span>
          <span>Arquitetura</span>
        </Marquee>
      </LazyMotion>
    );
    expect(screen.getAllByText("Engenharia")).toHaveLength(2);
    const clone = screen.getAllByText("Engenharia")[1].parentElement!;
    expect(clone).toHaveAttribute("aria-hidden", "true");
    expect(screen.getAllByText("Engenharia")[0].parentElement).toHaveAttribute("aria-hidden", "false");
  });

  it("movimento reduzido mostra uma cópia só, parada", () => {
    h.reduzido = true;
    render(
      <Marquee>
        <span>Engenharia</span>
      </Marquee>
    );
    expect(screen.getAllByText("Engenharia")).toHaveLength(1);
  });
});

describe("Parallax e ScrollSettle", () => {
  it.each([false, true])("renderizam o conteúdo (movimento reduzido: %s)", (reduzido) => {
    h.reduzido = reduzido;
    render(
      <LazyMotion features={domAnimation}>
        <Parallax className="camada">
          <p>Camada</p>
        </Parallax>
        <ScrollSettle className="painel">
          <p>Painel</p>
        </ScrollSettle>
      </LazyMotion>
    );
    expect(screen.getByText("Camada").parentElement).toHaveClass("camada");
    expect(screen.getByText("Painel").parentElement).toHaveClass("painel");
  });
});

describe("SmoothScroll", () => {
  const roda = (init: WheelEventInit) => {
    const ev = new WheelEvent("wheel", { cancelable: true, ...init });
    window.dispatchEvent(ev);
    return ev;
  };

  beforeEach(() => {
    Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 3000 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 1000 });
    Object.defineProperty(window, "scrollY", { configurable: true, writable: true, value: 0 });
    (window.scrollTo as unknown as ReturnType<typeof vi.fn>).mockClear?.();
  });

  it("intercepta a roda vertical e interpola até o alvo, sem passar do fim", () => {
    const { unmount } = render(<SmoothScroll />);
    const ev = roda({ deltaY: 5000 });
    expect(ev.defaultPrevented).toBe(true);
    rodarQuadros(200);
    const chamadas = (window.scrollTo as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(chamadas.at(-1)).toEqual([0, 2000]);
    // Valores intermediários sobem até o limite.
    expect(chamadas[0][1]).toBeGreaterThan(0);
    expect(chamadas[0][1]).toBeLessThan(2000);
    unmount();
  });

  it("não sobe acima do topo", () => {
    render(<SmoothScroll />);
    roda({ deltaY: -400 });
    rodarQuadros(5);
    const chamadas = (window.scrollTo as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(chamadas.length).toBeGreaterThan(0);
    expect(chamadas.every(([, y]) => y === 0)).toBe(true);
  });

  it("zoom (ctrl/meta) e rolagem horizontal ficam com o navegador", () => {
    render(<SmoothScroll />);
    expect(roda({ deltaY: 100, ctrlKey: true }).defaultPrevented).toBe(false);
    expect(roda({ deltaY: 100, metaKey: true }).defaultPrevented).toBe(false);
    expect(roda({ deltaY: 10, deltaX: 80 }).defaultPrevented).toBe(false);
    expect(filaRaf).toHaveLength(0);
  });

  it("scroll de teclado ou âncora reposiciona o alvo", () => {
    render(<SmoothScroll />);
    (window as unknown as { scrollY: number }).scrollY = 1500;
    window.dispatchEvent(new Event("scroll"));
    roda({ deltaY: 100 });
    rodarQuadros(300);
    const chamadas = (window.scrollTo as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(chamadas.at(-1)).toEqual([0, 1600]);
  });

  it("segundo giro durante a animação só move o alvo, sem novo laço", () => {
    render(<SmoothScroll />);
    roda({ deltaY: 100 });
    roda({ deltaY: 100 });
    expect(filaRaf).toHaveLength(1);
    rodarQuadros(300);
    expect((window.scrollTo as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)).toEqual([0, 200]);
  });

  it("movimento reduzido ou toque não interceptam", () => {
    h.reduzido = true;
    const a = render(<SmoothScroll />);
    expect(roda({ deltaY: 100 }).defaultPrevented).toBe(false);
    a.unmount();

    h.reduzido = false;
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      ...original(q),
      matches: q.includes("pointer: coarse"),
    })) as typeof window.matchMedia;
    const b = render(<SmoothScroll />);
    expect(roda({ deltaY: 100 }).defaultPrevented).toBe(false);
    b.unmount();
    window.matchMedia = original;
  });
});

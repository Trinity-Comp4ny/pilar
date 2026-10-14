import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { ReadingRing, RING_DELAY_MS } from "./ReadingRing";
import { particleCount, ringRadius, seedRing, startReadingRing, sweepGlow } from "./readingRingEngine";
import { routeSection } from "./useRouteEnter";

const ROOT = join(__dirname, "..", "..", "..");

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });

describe("varredura (ADR 0049)", () => {
  it("nenhum spinner genérico sobra no app nem na landing", () => {
    const offenders = [join(ROOT, "src"), join(ROOT, "apps/marketing/src")]
      .flatMap(sourceFiles)
      .filter((file) => /\bLoader2\b|\banimate-spin\b/.test(readFileSync(file, "utf8")))
      .map((file) => file.replace(`${ROOT}/`, ""));
    expect(offenders).toEqual([]);
  });

  it("as duas cópias do anel do boot são iguais", () => {
    const app = readFileSync(join(ROOT, "public/boot-ring.js"), "utf8");
    const landing = readFileSync(join(ROOT, "apps/marketing/public/boot-ring.js"), "utf8");
    expect(landing).toBe(app);
  });
});

describe("Button loading", () => {
  it("mostra o ritmo da marca, desabilita e avisa que está ocupado", () => {
    const { container } = render(<Button loading>Salvar proposta</Button>);
    const button = screen.getByRole("button", { name: /salvar proposta/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector(".pilar-mark--rhythm")).not.toBeNull();
  });
});

describe("ReadingRing", () => {
  // jsdom não pinta canvas; o motor sai cedo sem contexto 2D.
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("não aparece antes de 300ms e aparece depois", () => {
    vi.useFakeTimers();
    render(<ReadingRing size={64} />);
    const ring = screen.getByTestId("reading-ring");
    expect(ring).toHaveAttribute("data-visible", "false");
    act(() => vi.advanceTimersByTime(RING_DELAY_MS - 1));
    expect(ring).toHaveAttribute("data-visible", "false");
    act(() => vi.advanceTimersByTime(1));
    expect(ring).toHaveAttribute("data-visible", "true");
  });

  it("reserva o espaço desde o primeiro render", () => {
    render(<ReadingRing size={64} />);
    expect(screen.getByTestId("reading-ring")).toHaveStyle({ width: "64px", height: "64px" });
  });
});

describe("motor do anel", () => {
  it("é determinístico e escala os grãos com o tamanho", () => {
    expect(seedRing(200, 200)).toEqual(seedRing(200, 200));
    expect(seedRing(200, 200)).toHaveLength(particleCount(ringRadius(200, 200)));
    expect(particleCount(10)).toBe(120);
    expect(particleCount(1000)).toBe(720);
  });

  it("acende o trecho logo atrás da varredura e apaga o resto", () => {
    expect(sweepGlow(1, 1)).toBeCloseTo(1);
    expect(sweepGlow(1, 1.2)).toBeGreaterThan(sweepGlow(1, 3));
  });

  it("com movimento reduzido pinta um quadro e não agenda animação", () => {
    const raf = vi.spyOn(window, "requestAnimationFrame");
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const ctx = {
      clearRect: vi.fn(),
      setTransform: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      createRadialGradient: () => ({ addColorStop: vi.fn() }),
    };
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    Object.defineProperty(canvas, "clientWidth", { value: 100 });
    Object.defineProperty(canvas, "clientHeight", { value: 100 });

    const ring = startReadingRing(canvas);
    expect(ctx.fill).toHaveBeenCalled();
    expect(raf).not.toHaveBeenCalled();
    ring.stop();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});

describe("navegação comum (T05)", () => {
  it("anima só ao trocar de módulo, não de aba", () => {
    expect(routeSection("/financeiro/fluxo")).toBe(routeSection("/financeiro/mensal"));
    expect(routeSection("/projetos")).not.toBe(routeSection("/financeiro"));
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { startReadingRing } from "./readingRingEngine";

// Caminho animado do anel (o motion.test.tsx cobre o quadro único de movimento reduzido).
function fakeCtx() {
  return {
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    createRadialGradient: () => ({ addColorStop: vi.fn() }),
    globalAlpha: 1,
    fillStyle: "",
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("startReadingRing animado", () => {
  it("sem contexto 2D devolve stop inofensivo", () => {
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue(null);
    expect(() => startReadingRing(canvas).stop()).not.toThrow();
  });

  it("pinta a cada quadro visível, pausa fora da tela e para no stop", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((cb: FrameRequestCallback) => {
        frames.push(cb);
        return frames.length;
      })
    );
    const cancel = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancel);
    let ioCallback: (e: { isIntersecting: boolean }[]) => void = () => undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
          ioCallback = cb;
        }
        observe() {}
        disconnect = disconnect;
      }
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      }
    );

    const ctx = fakeCtx();
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    Object.defineProperty(canvas, "clientWidth", { value: 120 });
    Object.defineProperty(canvas, "clientHeight", { value: 120 });

    const ring = startReadingRing(canvas);
    expect(canvas.width).toBe(120);
    expect(ctx.fill).not.toHaveBeenCalled();

    frames.shift()!(16);
    frames.shift()!(500); // dt limitado a 50 ms
    expect(ctx.clearRect).toHaveBeenCalledTimes(2);

    ioCallback([{ isIntersecting: false }]);
    frames.shift()!(520);
    expect(ctx.clearRect).toHaveBeenCalledTimes(2);

    ioCallback([]);
    frames.shift()!(540);
    expect(ctx.clearRect).toHaveBeenCalledTimes(3);

    ring.stop();
    expect(cancel).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });

  it("canvas sem tamanho não pinta", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const ctx = fakeCtx();
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    const ring = startReadingRing(canvas);
    frames.shift()!(16);
    expect(ctx.clearRect).not.toHaveBeenCalled();
    ring.stop();
  });
});

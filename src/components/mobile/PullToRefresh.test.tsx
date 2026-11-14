import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PullToRefresh } from "./PullToRefresh";

function toque(tipo: string, y: number, alvo: Element | Document = document, x = 100) {
  const ev = new Event(tipo, { bubbles: true, cancelable: true }) as Event & { touches: unknown[] };
  ev.touches = tipo === "touchend" || tipo === "touchcancel" ? [] : [{ clientX: x, clientY: y }];
  alvo.dispatchEvent(ev);
  return ev;
}

describe("PullToRefresh", () => {
  let qc: QueryClient;

  beforeEach(() => {
    vi.useFakeTimers();
    qc = new QueryClient();
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    Object.defineProperty(navigator, "vibrate", { value: vi.fn(), configurable: true });
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    document.body.innerHTML = "";
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  const montar = () =>
    render(
      <QueryClientProvider client={qc}>
        <PullToRefresh />
      </QueryClientProvider>
    );

  it("puxar além do limiar e soltar refaz as consultas ativas", async () => {
    const spy = vi.spyOn(qc, "invalidateQueries");
    montar();
    toque("touchstart", 10);
    const mover = toque("touchmove", 260);
    expect(mover.defaultPrevented).toBe(true);
    toque("touchend", 260);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(spy).toHaveBeenCalledWith({ type: "active" });
  });

  it("puxão curto volta sem atualizar", async () => {
    const spy = vi.spyOn(qc, "invalidateQueries");
    montar();
    toque("touchstart", 10);
    toque("touchmove", 50);
    toque("touchend", 50);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("não puxa com a página rolada, subindo, na horizontal ou com diálogo aberto", async () => {
    const spy = vi.spyOn(qc, "invalidateQueries");
    montar();

    Object.defineProperty(window, "scrollY", { value: 40, configurable: true });
    toque("touchstart", 10);
    expect(toque("touchmove", 260).defaultPrevented).toBe(false);
    toque("touchend", 260);
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });

    toque("touchstart", 200);
    expect(toque("touchmove", 100).defaultPrevented).toBe(false);
    toque("touchend", 100);

    toque("touchstart", 10, document, 10);
    expect(toque("touchmove", 40, document, 200).defaultPrevented).toBe(false);
    toque("touchend", 40);

    document.body.innerHTML = '<div role="dialog"></div>';
    toque("touchstart", 10);
    expect(toque("touchmove", 260).defaultPrevented).toBe(false);
    toque("touchend", 260);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("touchcancel desfaz o puxão", async () => {
    const spy = vi.spyOn(qc, "invalidateQueries");
    montar();
    toque("touchstart", 10);
    toque("touchmove", 260);
    toque("touchcancel", 260);
    toque("touchend", 260);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("sem tela de toque não escuta nada", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    const spy = vi.spyOn(document, "addEventListener");
    montar();
    expect(spy).not.toHaveBeenCalledWith("touchstart", expect.anything(), expect.anything());
  });
});

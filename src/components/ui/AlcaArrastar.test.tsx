import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { AlcaArrastar } from "./AlcaArrastar";

function montar(aoFechar: () => void) {
  return render(
    <SheetPrimitive.Root open onOpenChange={(o) => !o && aoFechar()}>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Content aria-describedby={undefined} data-testid="painel">
          <SheetPrimitive.Title>t</SheetPrimitive.Title>
          <AlcaArrastar />
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </SheetPrimitive.Root>
  );
}

describe("AlcaArrastar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "vibrate", { value: vi.fn(), configurable: true });
  });
  afterEach(() => vi.useRealTimers());

  const alca = () => screen.getByTestId("painel").querySelector("[aria-hidden]") as HTMLElement;

  it("arrasto longo fecha o sheet", async () => {
    const fechar = vi.fn();
    montar(fechar);
    const painel = screen.getByTestId("painel");
    painel.getBoundingClientRect = () => ({ height: 300 }) as DOMRect;
    fireEvent.pointerDown(alca(), { pointerType: "touch", pointerId: 1, clientY: 0 });
    fireEvent.pointerMove(alca(), { pointerType: "touch", pointerId: 1, clientY: 200 });
    fireEvent.pointerUp(alca(), { pointerType: "touch", pointerId: 1 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(fechar).toHaveBeenCalled();
  });

  it("arrasto curto volta ao lugar", () => {
    const fechar = vi.fn();
    montar(fechar);
    const painel = screen.getByTestId("painel");
    painel.getBoundingClientRect = () => ({ height: 300 }) as DOMRect;
    fireEvent.pointerDown(alca(), { pointerType: "touch", pointerId: 1, clientY: 0 });
    fireEvent.pointerMove(alca(), { pointerType: "touch", pointerId: 1, clientY: 20 });
    fireEvent.pointerUp(alca(), { pointerType: "touch", pointerId: 1 });
    expect(painel.style.transform).toBe("");
    expect(fechar).not.toHaveBeenCalled();
  });

  it("mouse não arrasta", () => {
    montar(vi.fn());
    fireEvent.pointerDown(alca(), { pointerType: "mouse", clientY: 0 });
    fireEvent.pointerMove(alca(), { pointerType: "mouse", clientY: 200 });
    expect(screen.getByTestId("painel").style.transform).toBe("");
  });
});

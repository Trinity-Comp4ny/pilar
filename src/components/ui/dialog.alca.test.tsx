import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Dialog, DialogContent, DialogTitle } from "./dialog";

// Alça do painel de baixo no celular (SPEC 134): toque fecha, arraste curto não,
// arraste longo fecha. O dialog.mobile.test.tsx cobre só as classes e a presença.
function Painel() {
  const [open, setOpen] = useState(true);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle>Painel</DialogTitle>
      </DialogContent>
    </Dialog>
  );
}

function alca() {
  const el = screen.getAllByRole("button", { name: "Fechar" })[0];
  el.setPointerCapture = () => undefined;
  return el;
}

function arrastar(el: HTMLElement, de: number, ate: number) {
  fireEvent.pointerDown(el, { clientY: de, pointerId: 1 });
  fireEvent.pointerMove(el, { clientY: ate, pointerId: 1 });
  const painel = el.parentElement as HTMLElement;
  const transformDurante = painel.style.transform;
  fireEvent.pointerUp(el, { clientY: ate, pointerId: 1 });
  return { painel, transformDurante };
}

describe("DialogContent › alça de arrastar", () => {
  it("toque simples fecha", () => {
    render(<Painel />);
    fireEvent.click(alca());
    expect(screen.queryByText("Painel")).not.toBeInTheDocument();
  });

  it("arraste curto acompanha o dedo e volta sem fechar", () => {
    render(<Painel />);
    const el = alca();
    const { painel, transformDurante } = arrastar(el, 100, 150);
    expect(transformDurante).toBe("translateY(50px)");
    expect(painel.style.transform).toBe("");
    fireEvent.click(el);
    expect(screen.getByText("Painel")).toBeInTheDocument();
  });

  it("arraste longo fecha", () => {
    render(<Painel />);
    const el = alca();
    arrastar(el, 100, 300);
    fireEvent.click(el);
    expect(screen.queryByText("Painel")).not.toBeInTheDocument();
  });

  it("arrastar para cima não move; mover/soltar sem pressionar e cancelar restauram", () => {
    render(<Painel />);
    const el = alca();
    fireEvent.pointerMove(el, { clientY: 10 });
    fireEvent.pointerUp(el, { clientY: 10 });
    const { transformDurante } = arrastar(el, 200, 100);
    expect(transformDurante).toBe("translateY(0px)");

    fireEvent.pointerDown(el, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(el, { clientY: 400, pointerId: 1 });
    fireEvent.pointerCancel(el, { pointerId: 1 });
    expect((el.parentElement as HTMLElement).style.transform).toBe("");
    expect(screen.getByText("Painel")).toBeInTheDocument();
  });
});

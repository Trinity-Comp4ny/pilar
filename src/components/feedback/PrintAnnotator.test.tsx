import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrintAnnotator, type PrintAnnotatorHandle } from "./PrintAnnotator";

const h = vi.hoisted(() => ({ exportarPrint: vi.fn() }));

vi.mock("@/lib/feedbackPrint", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/feedbackPrint")>()),
  exportarPrint: h.exportarPrint,
}));

function fakeCtx() {
  return {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "",
    lineJoin: "",
  };
}

let ctx: ReturnType<typeof fakeCtx>;

function imagem(w = 800, hgt = 400) {
  const img = document.createElement("img");
  Object.defineProperty(img, "naturalWidth", { value: w });
  Object.defineProperty(img, "naturalHeight", { value: hgt });
  return img;
}

function canvas() {
  const el = screen.getByLabelText(/Print anexado/) as HTMLCanvasElement;
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200 }) as DOMRect;
  el.setPointerCapture = vi.fn();
  return el;
}

function arrastar(el: HTMLCanvasElement, de: [number, number], ate?: [number, number]) {
  fireEvent.pointerDown(el, { clientX: de[0], clientY: de[1], pointerId: 1 });
  if (ate) fireEvent.pointerMove(el, { clientX: ate[0], clientY: ate[1], pointerId: 1 });
  fireEvent.pointerUp(el, { pointerId: 1 });
}

beforeEach(() => {
  ctx = fakeCtx();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.style.removeProperty("--chart-danger");
});

describe("PrintAnnotator", () => {
  it("desenha a imagem no tamanho real com a cor de fallback", () => {
    render(<PrintAnnotator imagem={imagem()} onRemover={vi.fn()} />);
    const el = canvas();
    expect(el.width).toBe(800);
    expect(el.height).toBe(400);
    expect(ctx.drawImage).toHaveBeenCalled();
    expect(ctx.strokeStyle).toBe("hsl(0 84% 60%)");
    expect(screen.getByRole("button", { name: /Desfazer/ })).toBeDisabled();
  });

  it("usa o token --chart-danger quando definido", () => {
    document.documentElement.style.setProperty("--chart-danger", "10 80% 50%");
    render(<PrintAnnotator imagem={imagem()} onRemover={vi.fn()} />);
    expect(ctx.strokeStyle).toBe("hsl(10 80% 50%)");
  });

  it("caneta converte o ponto exibido para coordenadas da imagem", () => {
    render(<PrintAnnotator imagem={imagem()} onRemover={vi.fn()} />);
    const el = canvas();
    arrastar(el, [10, 20], [30, 40]);
    expect(el.setPointerCapture).toHaveBeenCalledWith(1);
    // escala 2x: 400 exibido -> 800 real
    expect(ctx.moveTo).toHaveBeenCalledWith(20, 40);
    expect(ctx.lineTo).toHaveBeenCalledWith(60, 80);
    expect(screen.getByRole("button", { name: /Desfazer/ })).toBeEnabled();
  });

  it("clique sem arrastar vira um ponto visível", () => {
    render(<PrintAnnotator imagem={imagem()} onRemover={vi.fn()} />);
    arrastar(canvas(), [5, 5]);
    expect(ctx.lineTo).toHaveBeenCalledWith(10.1, 10.1);
  });

  it("retângulo normaliza o arrasto e desfazer remove a marca", async () => {
    const user = userEvent.setup();
    render(<PrintAnnotator imagem={imagem()} onRemover={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Retângulo/ }));
    expect(screen.getByRole("button", { name: /Retângulo/ })).toHaveAttribute("aria-pressed", "true");
    arrastar(canvas(), [50, 50], [10, 20]);
    expect(ctx.strokeRect).toHaveBeenLastCalledWith(20, 40, 80, 60);

    ctx.strokeRect.mockClear();
    await user.click(screen.getByRole("button", { name: /Desfazer/ }));
    expect(ctx.strokeRect).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Desfazer/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Caneta/ }));
    expect(screen.getByRole("button", { name: /Caneta/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("mover ou soltar sem pressionar não cria marca", () => {
    render(<PrintAnnotator imagem={imagem()} onRemover={vi.fn()} />);
    const el = canvas();
    fireEvent.pointerMove(el, { clientX: 1, clientY: 1 });
    fireEvent.pointerUp(el);
    expect(screen.getByRole("button", { name: /Desfazer/ })).toBeDisabled();
  });

  it("remover chama o callback", async () => {
    const onRemover = vi.fn();
    render(<PrintAnnotator imagem={imagem()} onRemover={onRemover} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Remover print/ }));
    expect(onRemover).toHaveBeenCalled();
  });

  it("exportar delega ao exportarPrint com o canvas", async () => {
    h.exportarPrint.mockResolvedValue({ blob: new Blob(), extensao: "png" });
    const ref = createRef<PrintAnnotatorHandle>();
    render(<PrintAnnotator ref={ref} imagem={imagem()} onRemover={vi.fn()} />);
    await expect(ref.current!.exportar()).resolves.toMatchObject({ extensao: "png" });
    expect(h.exportarPrint).toHaveBeenCalledWith(canvas());
  });

  it("sem contexto 2D não quebra", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(<PrintAnnotator imagem={imagem()} onRemover={vi.fn()} />);
    expect(canvas()).toBeInTheDocument();
  });
});

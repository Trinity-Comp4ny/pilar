import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Evento = "onload" | "onerror";

let evento: Evento = "onload";
let srcDescriptor: PropertyDescriptor | undefined;

function fakeCtx() {
  return {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    globalCompositeOperation: "",
    fillStyle: "",
  };
}

let ctx: ReturnType<typeof fakeCtx> | null;

async function carregar() {
  vi.resetModules();
  return import("./favicon");
}

beforeEach(() => {
  evento = "onload";
  ctx = fakeCtx();
  document.head.innerHTML = '<link rel="icon" href="/favicon.svg" type="image/svg+xml">';
  srcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  Object.defineProperty(HTMLImageElement.prototype, "src", {
    configurable: true,
    set(this: HTMLImageElement) {
      queueMicrotask(() => (this[evento] as ((e?: unknown) => void) | null)?.(new Event("x")));
    },
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => ctx as unknown as CanvasRenderingContext2D
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,AAA");
});

afterEach(() => {
  if (srcDescriptor) Object.defineProperty(HTMLImageElement.prototype, "src", srcDescriptor);
  vi.restoreAllMocks();
  document.head.innerHTML = "";
});

const link = () => document.querySelector<HTMLLinkElement>('link[rel="icon"]')!;

describe("setFaviconBadge", () => {
  it("com badge: fura o círculo e pinta a bolinha vermelha", async () => {
    const { setFaviconBadge } = await carregar();
    await setFaviconBadge(true);
    expect(ctx!.drawImage).toHaveBeenCalled();
    expect(ctx!.arc).toHaveBeenCalledTimes(2);
    expect(ctx!.fillStyle).toBe("#EF4444");
    expect(link().type).toBe("image/png");
    expect(link().href).toBe("data:image/png;base64,AAA");
  });

  it("sem badge: só redesenha a base", async () => {
    const { setFaviconBadge } = await carregar();
    await setFaviconBadge(false);
    expect(ctx!.arc).not.toHaveBeenCalled();
    expect(link().href).toContain("data:image/png");
  });

  it("não redesenha quando o estado não muda", async () => {
    const { setFaviconBadge } = await carregar();
    await setFaviconBadge(true);
    await setFaviconBadge(true);
    expect(ctx!.drawImage).toHaveBeenCalledTimes(1);
  });

  it("sem <link rel=icon> não faz nada", async () => {
    document.head.innerHTML = "";
    const { setFaviconBadge } = await carregar();
    await setFaviconBadge(true);
    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled();
  });

  it("sem contexto 2D mantém o favicon atual", async () => {
    ctx = null;
    const { setFaviconBadge } = await carregar();
    await setFaviconBadge(true);
    expect(link().getAttribute("href")).toBe("/favicon.svg");
  });

  it("falha ao carregar a imagem mantém o favicon e permite tentar de novo", async () => {
    evento = "onerror";
    const { setFaviconBadge } = await carregar();
    await setFaviconBadge(true);
    expect(link().getAttribute("href")).toBe("/favicon.svg");
    evento = "onload";
    await setFaviconBadge(true);
    expect(link().href).toContain("data:image/png");
  });
});

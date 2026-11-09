import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { capturarTela, carregarImagem, exportarPrint, podeCapturarTela } from "./feedbackPrint";

const MB = 1024 * 1024;

function canvasComBlobs(...tamanhos: (number | null)[]) {
  const canvas = document.createElement("canvas");
  const tipos: string[] = [];
  canvas.toBlob = vi.fn((cb: BlobCallback, tipo?: string) => {
    tipos.push(tipo ?? "");
    const tam = tamanhos.shift();
    cb(tam === null || tam === undefined ? null : ({ size: tam, type: tipo } as Blob));
  }) as HTMLCanvasElement["toBlob"];
  return { canvas, tipos };
}

describe("exportarPrint", () => {
  it("mantém PNG quando cabe no limite", async () => {
    const { canvas, tipos } = canvasComBlobs(1 * MB);
    await expect(exportarPrint(canvas)).resolves.toMatchObject({ extensao: "png" });
    expect(tipos).toEqual(["image/png"]);
  });

  it("cai para JPEG quando o PNG passa de 5 MB", async () => {
    const { canvas, tipos } = canvasComBlobs(6 * MB, 2 * MB);
    await expect(exportarPrint(canvas)).resolves.toMatchObject({ extensao: "jpg" });
    expect(tipos).toEqual(["image/png", "image/jpeg"]);
  });

  it("recusa quando nem o JPEG cabe", async () => {
    const { canvas } = canvasComBlobs(9 * MB, 6 * MB);
    await expect(exportarPrint(canvas)).rejects.toThrow(/grande demais/);
  });

  it("rejeita quando o canvas não gera blob", async () => {
    const { canvas } = canvasComBlobs(null);
    await expect(exportarPrint(canvas)).rejects.toThrow(/gerar a imagem/);
  });
});

describe("carregarImagem", () => {
  const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  let srcDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:fake");
    URL.revokeObjectURL = vi.fn();
    srcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  });

  afterEach(() => {
    URL.createObjectURL = original.create;
    URL.revokeObjectURL = original.revoke;
    if (srcDescriptor) Object.defineProperty(HTMLImageElement.prototype, "src", srcDescriptor);
  });

  function simularCarga(evento: "onload" | "onerror") {
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      configurable: true,
      set(this: HTMLImageElement) {
        queueMicrotask(() => (this[evento] as () => void)?.());
      },
    });
  }

  it("resolve com a imagem e libera a URL", async () => {
    simularCarga("onload");
    const img = await carregarImagem(new Blob(["x"]));
    expect(img).toBeInstanceOf(HTMLImageElement);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });

  it("rejeita com mensagem amigável quando a imagem não abre", async () => {
    simularCarga("onerror");
    await expect(carregarImagem(new Blob(["x"]))).rejects.toThrow(/PNG ou JPG/);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });
});

describe("captura de tela", () => {
  const mediaOriginal = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");

  afterEach(() => {
    if (mediaOriginal) Object.defineProperty(navigator, "mediaDevices", mediaOriginal);
    else delete (navigator as { mediaDevices?: unknown }).mediaDevices;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("podeCapturarTela depende da Screen Capture API", () => {
    Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });
    expect(podeCapturarTela()).toBe(false);
    Object.defineProperty(navigator, "mediaDevices", { value: { getDisplayMedia: vi.fn() }, configurable: true });
    expect(podeCapturarTela()).toBe(true);
  });

  it("capturarTela pega um frame e sempre encerra o stream", async () => {
    vi.useFakeTimers();
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }, { stop }] };
    const getDisplayMedia = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, "mediaDevices", { value: { getDisplayMedia }, configurable: true });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb: BlobCallback) =>
      cb({ size: 10, type: "image/png" } as Blob)
    );

    const promessa = capturarTela();
    await vi.advanceTimersByTimeAsync(300);
    const blob = await promessa;

    expect(blob.size).toBe(10);
    expect(getDisplayMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false, preferCurrentTab: true }));
    expect(drawImage).toHaveBeenCalled();
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it("capturarTela encerra o stream mesmo se o vídeo falhar", async () => {
    const stop = vi.fn();
    const getDisplayMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
    Object.defineProperty(navigator, "mediaDevices", { value: { getDisplayMedia }, configurable: true });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(new Error("autoplay"));
    await expect(capturarTela()).rejects.toThrow("autoplay");
    expect(stop).toHaveBeenCalled();
  });
});

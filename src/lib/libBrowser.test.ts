import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  driver: vi.fn(),
  drive: vi.fn(),
  getDocument: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: h.rpc } }));
vi.mock("driver.js", () => ({
  driver: (cfg: unknown) => {
    h.driver(cfg);
    return { drive: h.drive };
  },
}));
vi.mock("driver.js/dist/driver.css", () => ({}));
vi.mock("@/styles/onboarding-tour.css", () => ({}));
vi.mock("pdfjs-dist", () => ({ GlobalWorkerOptions: { workerSrc: "" }, getDocument: h.getDocument }));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "/worker.mjs" }));

import { EMPTY_ONBOARDING_STATE, parseOnboardingState, persistOnboardingState } from "./onboarding/state";
import { startStepTour } from "./onboarding/tour";
import { comprimirFoto } from "./comprimirFoto";
import { extrairTextoPdf } from "./pdfText";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("onboarding/state", () => {
  it("valida o JSON do banco na fronteira", () => {
    expect(parseOnboardingState(null)).toEqual(EMPTY_ONBOARDING_STATE);
    expect(parseOnboardingState("x")).toEqual(EMPTY_ONBOARDING_STATE);
    expect(parseOnboardingState({ dismissed: "sim", completed_at: 5, tours_seen: "a" })).toEqual(
      EMPTY_ONBOARDING_STATE
    );
    expect(parseOnboardingState({ dismissed: true, completed_at: "2026-11-01", tours_seen: ["a", 1, "b"] })).toEqual({
      dismissed: true,
      completed_at: "2026-11-01",
      tours_seen: ["a", "b"],
      boas_vindas_dispensada: false,
    });
    expect(parseOnboardingState(undefined)).not.toBe(EMPTY_ONBOARDING_STATE);
  });

  it("persiste o patch pela RPC e propaga erro", async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: null });
    await persistOnboardingState({ dismissed: true });
    expect(h.rpc).toHaveBeenCalledWith("set_onboarding_state", { patch: { dismissed: true } });
    h.rpc.mockResolvedValueOnce({ data: null, error: { message: "sem perfil" } });
    await expect(persistOnboardingState({})).rejects.toThrow("sem perfil");
  });
});

describe("onboarding/tour", () => {
  const STEP = { tour: { selector: "novo-projeto", titulo: "Crie", texto: "Clique aqui" } } as Parameters<
    typeof startStepTour
  >[0];

  it("sem o alvo na tela não dispara", () => {
    expect(startStepTour(STEP, vi.fn())).toBeNull();
    expect(h.driver).not.toHaveBeenCalled();
  });

  it("destaca o alvo e chama onDone uma vez só", () => {
    document.body.innerHTML = '<button data-tour="novo-projeto">x</button>';
    const onDone = vi.fn();
    expect(startStepTour(STEP, onDone)).not.toBeNull();
    expect(h.drive).toHaveBeenCalled();
    const cfg = h.driver.mock.calls[0][0] as {
      steps: { element: string; popover: { title: string } }[];
      onDestroyed: () => void;
    };
    expect(cfg.steps[0]).toMatchObject({ element: '[data-tour="novo-projeto"]', popover: { title: "Crie" } });
    cfg.onDestroyed();
    cfg.onDestroyed();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe("comprimirFoto", () => {
  function prepararCanvas(ctx: unknown, blob: Blob | null) {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb: BlobCallback) => cb(blob));
  }

  it("reduz para no máximo 1600 px no lado maior e gera JPEG", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 4000, height: 3000 }));
    const drawImage = vi.fn();
    prepararCanvas({ drawImage }, new Blob(["j"], { type: "image/jpeg" }));
    const blob = await comprimirFoto(new File(["x"], "foto.jpg"));
    expect(blob.type).toBe("image/jpeg");
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 1200);
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.8);
  });

  it("foto pequena não é ampliada", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 800, height: 600 }));
    const drawImage = vi.fn();
    prepararCanvas({ drawImage }, new Blob(["j"]));
    await comprimirFoto(new File(["x"], "foto.jpg"));
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 800, 600);
  });

  it("falha sem canvas ou sem blob", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 10, height: 10 }));
    prepararCanvas(null, null);
    await expect(comprimirFoto(new File(["x"], "a.jpg"))).rejects.toThrow("canvas indisponível");
    vi.restoreAllMocks();
    prepararCanvas({ drawImage: vi.fn() }, null);
    await expect(comprimirFoto(new File(["x"], "a.jpg"))).rejects.toThrow("não deu para comprimir a foto");
  });
});

describe("extrairTextoPdf", () => {
  it("junta o texto de cada página, ignora páginas vazias e sempre destrói o documento", async () => {
    const destroy = vi.fn();
    const paginas = [
      { items: [{ str: "Nota  fiscal" }, { str: "  123 " }, { tipo: "marcado" }] },
      { items: [{ str: "   " }] },
      { items: [{ str: "Total R$ 10" }] },
    ];
    h.getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 3,
        getPage: async (n: number) => ({ getTextContent: async () => paginas[n - 1] }),
        destroy,
      }),
    });
    const file = new File(["%PDF"], "nf.pdf");
    Object.defineProperty(file, "arrayBuffer", { value: async () => new ArrayBuffer(4) });
    expect(await extrairTextoPdf(file)).toBe("Nota fiscal 123\nTotal R$ 10");
    expect(destroy).toHaveBeenCalled();
  });

  it("erro numa página ainda destrói o documento", async () => {
    const destroy = vi.fn();
    h.getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: async () => {
          throw new Error("página corrompida");
        },
        destroy,
      }),
    });
    const file = new File(["%PDF"], "nf.pdf");
    Object.defineProperty(file, "arrayBuffer", { value: async () => new ArrayBuffer(4) });
    await expect(extrairTextoPdf(file)).rejects.toThrow("página corrompida");
    expect(destroy).toHaveBeenCalled();
  });
});

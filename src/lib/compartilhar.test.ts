import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compartilhar, linkWhatsApp, temCompartilharNativo } from "./compartilhar";

function toque(coarse: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: coarse }) as unknown as typeof window.matchMedia;
}
function definir(nome: string, valor: unknown) {
  Object.defineProperty(navigator, nome, { value: valor, configurable: true });
}

describe("compartilhar", () => {
  beforeEach(() => {
    definir("vibrate", vi.fn());
  });
  afterEach(() => {
    definir("share", undefined);
    definir("canShare", undefined);
    definir("clipboard", undefined);
  });

  it("só tem folha nativa com navigator.share e tela de toque", () => {
    definir("share", vi.fn());
    toque(false);
    expect(temCompartilharNativo()).toBe(false);
    toque(true);
    expect(temCompartilharNativo()).toBe(true);
    definir("share", undefined);
    expect(temCompartilharNativo()).toBe(false);
  });

  it("usa a folha nativa quando disponível", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    definir("share", share);
    toque(true);
    expect(await compartilhar({ titulo: "T", texto: "x", url: "https://a.b" })).toBe("compartilhado");
    expect(share).toHaveBeenCalledWith({ title: "T", text: "x", url: "https://a.b" });
  });

  it("fechar a folha sem escolher é cancelado", async () => {
    definir("share", vi.fn().mockRejectedValue(new DOMException("x", "AbortError")));
    toque(true);
    expect(await compartilhar({ url: "https://a.b" })).toBe("cancelado");
  });

  it("sem folha nativa copia texto e link", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    definir("clipboard", { writeText });
    toque(false);
    expect(await compartilhar({ texto: "Veja", url: "https://a.b" })).toBe("copiado");
    expect(writeText).toHaveBeenCalledWith("Veja\nhttps://a.b");
  });

  it("falha na folha cai no copiar; sem área de transferência, falhou", async () => {
    definir("share", vi.fn().mockRejectedValue(new Error("boom")));
    toque(true);
    definir("clipboard", { writeText: vi.fn().mockResolvedValue(undefined) });
    expect(await compartilhar({ url: "u" })).toBe("copiado");
    definir("clipboard", { writeText: vi.fn().mockRejectedValue(new Error("nope")) });
    expect(await compartilhar({ url: "u" })).toBe("falhou");
  });

  it("respeita canShare", async () => {
    definir("share", vi.fn());
    definir("canShare", () => false);
    toque(true);
    definir("clipboard", { writeText: vi.fn().mockResolvedValue(undefined) });
    expect(await compartilhar({ url: "u" })).toBe("copiado");
  });

  it("monta link do WhatsApp", () => {
    expect(linkWhatsApp("Oi", "https://a.b/c d")).toBe(
      `https://wa.me/?text=${encodeURIComponent("Oi\nhttps://a.b/c d")}`
    );
  });
});

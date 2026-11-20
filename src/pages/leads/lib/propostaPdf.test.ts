import { describe, expect, it } from "vitest";
import { PROPOSTA_PDF_MAX_BYTES, propostaPdfSchema, validarPropostaPdf } from "@/lib/propostaPdfArquivo";
function arquivo(nome: string, texto: string, tamanho?: number) {
  return {
    name: nome,
    size: tamanho ?? texto.length,
    slice: () => ({ arrayBuffer: async () => new TextEncoder().encode(texto.slice(0, 5)).buffer }),
  } as File;
}
describe("PDF da proposta", () => {
  it("aceita PDF pronto e extensão sem diferenciar maiúsculas", async () => {
    expect(await validarPropostaPdf(arquivo("proposta.PDF", "%PDF-1.7"))).toBeNull();
  });
  it("recusa vazio, arquivo disfarçado e maior que 15 MB", async () => {
    expect(await validarPropostaPdf(null)).toMatch(/Selecione/);
    expect(await validarPropostaPdf(arquivo("arquivo.txt", "%PDF-"))).toMatch(/PDF/);
    expect(await validarPropostaPdf(arquivo("arquivo.pdf", "<html>"))).toMatch(/válido/);
    expect(await validarPropostaPdf(arquivo("arquivo.pdf", ""))).toMatch(/vazio/);
    expect(await validarPropostaPdf(arquivo("arquivo.pdf", "%PDF-", PROPOSTA_PDF_MAX_BYTES + 1))).toMatch(/15 MB/);
  });
  it("não aceita condição extensa ou valor inválido", () => {
    expect(propostaPdfSchema.safeParse({ titulo: "Proposta", valor: -1, condicoes: "", motivo: "" }).success).toBe(
      false
    );
    expect(
      propostaPdfSchema.safeParse({ titulo: "Proposta", valor: 0, condicoes: "x".repeat(10001), motivo: "" }).success
    ).toBe(false);
  });
});

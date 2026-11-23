import { describe, expect, it } from "vitest";
import { meioParaRascunho, novoRascunho, rascunhosParaMeios, validarRascunhos } from "./meiosRecebimentoForm";

describe("meiosRecebimentoForm", () => {
  it("converte meio com faixas para rascunho e de volta", () => {
    const meio = { id: "cartao", nome: "Cartão", taxa_pct: 0, faixas: { "7": 4.5, "1": 2.99 } };
    const r = meioParaRascunho(meio);
    expect(r.faixas).toEqual([
      { parcelas: "1", taxa: "2,99" },
      { parcelas: "7", taxa: "4,5" },
    ]);
    expect(rascunhosParaMeios([r])).toEqual([
      { id: "cartao", nome: "Cartão", taxa_pct: 0, faixas: { "1": 2.99, "7": 4.5 } },
    ]);
  });

  it("meio sem faixas guarda só a taxa e aceita vírgula", () => {
    const r = { ...novoRascunho(), id: "boleto", nome: " Boleto ", taxa: "1,5" };
    expect(rascunhosParaMeios([r])).toEqual([{ id: "boleto", nome: "Boleto", taxa_pct: 1.5 }]);
  });

  it("valida lista vazia, nome, taxa, parcelas e faixa repetida", () => {
    const ok = { ...novoRascunho(), nome: "PIX" };
    expect(validarRascunhos([])).toMatch(/pelo menos um/);
    expect(validarRascunhos([{ ...ok, nome: " " }])).toMatch(/nome/);
    expect(validarRascunhos([{ ...ok, taxa: "100" }])).toMatch(/Taxa inválida/);
    expect(validarRascunhos([{ ...ok, faixas: [{ parcelas: "0", taxa: "1" }] }])).toMatch(/Parcelas inválidas/);
    expect(
      validarRascunhos([
        {
          ...ok,
          faixas: [
            { parcelas: "2", taxa: "1" },
            { parcelas: "2", taxa: "2" },
          ],
        },
      ])
    ).toMatch(/repete/);
    expect(validarRascunhos([{ ...ok, faixas: [{ parcelas: "2", taxa: "x" }] }])).toMatch(/Taxa inválida/);
    expect(validarRascunhos([ok])).toBeNull();
  });
});

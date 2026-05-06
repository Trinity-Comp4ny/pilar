import { describe, it, expect } from "vitest";
import { valorCurrencyField, parcelasField, descricaoField, dataVencimentoField } from "./financialFields";

describe("valorCurrencyField", () => {
  it("aceita valor positivo formatado em BRL", () => {
    expect(valorCurrencyField.safeParse("R$ 1.500,00").success).toBe(true);
    expect(valorCurrencyField.safeParse("R$ 0,01").success).toBe(true);
  });

  it("rejeita string vazia", () => {
    const r = valorCurrencyField.safeParse("");
    expect(r.success).toBe(false);
  });

  it("rejeita valor zero", () => {
    const r = valorCurrencyField.safeParse("R$ 0,00");
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toContain("maior que zero");
    }
  });

  it("rejeita valor negativo via string sem dígitos", () => {
    const r = valorCurrencyField.safeParse("abc");
    expect(r.success).toBe(false);
  });
});

describe("parcelasField", () => {
  it("aceita 1 parcela", () => {
    expect(parcelasField.safeParse("1").success).toBe(true);
  });

  it("aceita 12 parcelas", () => {
    expect(parcelasField.safeParse("12").success).toBe(true);
  });

  it("aceita 60 parcelas (máximo)", () => {
    expect(parcelasField.safeParse("60").success).toBe(true);
  });

  it("rejeita 0 parcelas", () => {
    expect(parcelasField.safeParse("0").success).toBe(false);
  });

  it("rejeita 61 parcelas (acima do máximo)", () => {
    expect(parcelasField.safeParse("61").success).toBe(false);
  });

  it("usa 1 como default", () => {
    const r = parcelasField.safeParse(undefined);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("1");
  });
});

describe("descricaoField", () => {
  it("aceita descrição preenchida", () => {
    expect(descricaoField.safeParse("Serviço de consultoria").success).toBe(true);
  });

  it("rejeita string vazia", () => {
    expect(descricaoField.safeParse("").success).toBe(false);
  });
});

describe("dataVencimentoField", () => {
  it("aceita objeto Date", () => {
    expect(dataVencimentoField.safeParse(new Date()).success).toBe(true);
  });

  it("rejeita undefined", () => {
    expect(dataVencimentoField.safeParse(undefined).success).toBe(false);
  });

  it("rejeita string de data", () => {
    expect(dataVencimentoField.safeParse("2026-05-01").success).toBe(false);
  });
});

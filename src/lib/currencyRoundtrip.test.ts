import { describe, expect, it } from "vitest";
import { formatCurrencyInput, formatValorToInput, parseCurrencyString } from "./currencyUtils";
import { formatCurrency } from "./format";
import { getDisplayDate } from "./dateUtils";

// Ida e volta do dinheiro nos formulários: o que a máscara mostra é exatamente
// o que o parse grava, e o valor gravado volta ao campo igual na edição.

const nbsp = (s: string) => s.replace(/\u00a0/g, " ");

describe("máscara → parse → formatação", () => {
  it.each([
    ["1", 0.01],
    ["99", 0.99],
    ["100", 1],
    ["123456", 1234.56],
    ["100000000", 1000000],
    ["9999999999", 99999999.99],
  ])("dígitos %s viram %d reais sem perder centavo", (digitos, reais) => {
    const mascarado = formatCurrencyInput(digitos);
    expect(parseCurrencyString(mascarado)).toBe(reais);
  });

  it.each([0.01, 0.1, 0.3, 19.99, 1234.56, 1000000, 33.33])(
    "valor gravado %d volta ao campo e reparseia igual",
    (v) => {
      expect(parseCurrencyString(formatValorToInput(v))).toBe(v);
    }
  );

  it("colar valor com 3 casas trunca para centavos (não arredonda para cima)", () => {
    expect(parseCurrencyString("1.234,569")).toBe(1234.56);
  });

  it("colar valor com espaços e texto em volta", () => {
    expect(parseCurrencyString("  R$ 2.500,00 (bruto) ")).toBe(2500);
  });

  it("formatCurrency arredonda meio centavo de forma estável", () => {
    expect(nbsp(formatCurrency(0.125))).toMatch(/^R\$ 0,1[23]$/);
    expect(nbsp(formatCurrency(1.005))).toMatch(/^R\$ 1,0[01]$/);
  });

  it("saldo zerado por resíduo de float não aparece como -R$ 0,00", () => {
    expect(nbsp(formatCurrency(0.3 - 0.1 - 0.2))).toBe("R$ 0,00");
    expect(nbsp(formatCurrency(-0))).toBe("R$ 0,00");
    expect(nbsp(formatCurrency(-0.004, { decimals: 0 }))).toBe("R$ 0");
    expect(nbsp(formatCurrency(-0.01))).toBe("-R$ 0,01");
  });

  it("formatCurrency de valores típicos de KPI", () => {
    expect(nbsp(formatCurrency(-3500.75))).toBe("-R$ 3.500,75");
    expect(nbsp(formatCurrency(0.1 + 0.2))).toBe("R$ 0,30");
    expect(nbsp(formatCurrency(1_500_000, { compact: true }))).toBe("R$ 1,5 mi");
  });
});

describe("getDisplayDate em despesas", () => {
  it("despesa paga usa a data de pagamento", () => {
    expect(getDisplayDate("2026-10-03", "2026-10-05", "Pago")).toBe("2026-10-03");
  });

  it("despesa pendente sem pagamento usa o vencimento", () => {
    expect(getDisplayDate(null, "2026-10-05", "Pendente")).toBe("2026-10-05");
  });
});

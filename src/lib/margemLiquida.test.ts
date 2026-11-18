import { describe, expect, it } from "vitest";
import {
  aplicaDesconto,
  descontoMaximoPct,
  lucroLiquido,
  margemLiquidaPct,
  precoSugerido,
  semaforoMargem,
  taxaDoMeio,
} from "@/lib/margemLiquida";

const semTaxa = { impostoPct: 6, taxaPct: 0 };
const comCartao = { impostoPct: 6, taxaPct: 3.5 };

describe("margemLiquida", () => {
  it("sugere preço pela margem-alvo", () => {
    expect(precoSugerido(7000, 30, semTaxa)).toBe(10937.5);
  });

  it("calcula a margem líquida depois de imposto e taxa", () => {
    expect(margemLiquidaPct(10000, 7000, comCartao)).toBeCloseTo(20.5, 5);
  });

  it("desconto máximo leva exatamente à margem mínima", () => {
    const tabela = 10937.5;
    const desc = descontoMaximoPct(tabela, 7000, 15, comCartao) as number;
    expect(desc).toBeGreaterThan(0);
    const preco = aplicaDesconto(tabela, desc);
    expect(margemLiquidaPct(preco, 7000, comCartao)).toBeCloseTo(15, 1);
  });

  it("desconto de empate usa margem mínima zero", () => {
    const desc = descontoMaximoPct(10000, 7000, 0, semTaxa) as number;
    expect(margemLiquidaPct(aplicaDesconto(10000, desc), 7000, semTaxa)).toBeCloseTo(0, 1);
  });

  it("desconto máximo é zero quando a tabela já está abaixo do mínimo", () => {
    expect(descontoMaximoPct(7500, 7000, 30, semTaxa)).toBe(0);
  });

  it("não sugere preço quando margem + imposto + taxa >= 100%", () => {
    expect(precoSugerido(7000, 91, comCartao)).toBeNull();
  });

  it("custo zero ou preço zero não quebra", () => {
    expect(precoSugerido(0, 30, semTaxa)).toBeNull();
    expect(margemLiquidaPct(0, 7000, semTaxa)).toBeNull();
    expect(descontoMaximoPct(0, 7000, 10, semTaxa)).toBeNull();
  });

  it("lucro líquido desconta imposto, taxa e custo", () => {
    expect(lucroLiquido(10000, 7000, comCartao)).toBe(2050);
  });

  it("semáforo por faixa", () => {
    expect(semaforoMargem(35, 30, 15)).toBe("verde");
    expect(semaforoMargem(20, 30, 15)).toBe("amarelo");
    expect(semaforoMargem(10, 30, 15)).toBe("vermelho");
    expect(semaforoMargem(null, 30, 15)).toBeNull();
  });

  it("taxa do meio por parcelas", () => {
    const cartao = { id: "c", nome: "Cartão", taxa_pct: 0, faixas: { "1": 2.5, "2": 4, "7": 6 } };
    expect(taxaDoMeio(cartao, 1)).toBe(2.5);
    expect(taxaDoMeio(cartao, 3)).toBe(4);
    expect(taxaDoMeio(cartao, 12)).toBe(6);
    expect(taxaDoMeio({ id: "p", nome: "PIX", taxa_pct: 0.5 }, 1)).toBe(0.5);
    expect(taxaDoMeio(undefined, 1)).toBe(0);
  });
});

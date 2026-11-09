import { describe, expect, it } from "vitest";
import { lerProposta, type CamposProposta } from "./cotarSchema";

const base: CamposProposta = {
  valor: "R$ 20.900,00",
  valorParcelado: "",
  condicao: "30 dias",
  desconto: "",
  prazo: "5",
  observacoes: "",
};

describe("lerProposta", () => {
  it("monta o corpo da edge a partir do que a pessoa digitou", () => {
    expect(
      lerProposta({ ...base, valorParcelado: "R$ 21.500,00", desconto: "3,5", observacoes: " frete incluso " })
    ).toEqual({
      ok: true,
      dados: {
        valor: 20900,
        valor_parcelado: 21500,
        condicao_pagamento: "30 dias",
        desconto_pct: 3.5,
        prazo_entrega_dias: 5,
        observacoes: "frete incluso",
      },
    });
  });

  it("opcionais em branco viram null", () => {
    const r = lerProposta(base);
    expect(r.ok && r.dados).toMatchObject({ valor_parcelado: null, desconto_pct: null, observacoes: null });
  });

  it("valor zero ou vazio é recusado com a mensagem do campo", () => {
    expect(lerProposta({ ...base, valor: "" })).toEqual({
      ok: false,
      erros: { valor: "Informe o valor à vista, maior que zero." },
    });
    expect(lerProposta({ ...base, valor: "R$ 0,00" }).ok).toBe(false);
  });

  it("prazo fracionado, negativo ou em branco é recusado", () => {
    for (const prazo of ["2,5", "-1", "", "abc", "4000"]) {
      expect(lerProposta({ ...base, prazo })).toEqual({
        ok: false,
        erros: { prazo: "Informe o prazo em dias, com número inteiro." },
      });
    }
  });

  it("desconto fora de 0 a 100 é recusado", () => {
    expect(lerProposta({ ...base, desconto: "101" })).toEqual({
      ok: false,
      erros: { desconto: "O desconto vai de 0 a 100." },
    });
  });

  it("junta os erros de vários campos de uma vez", () => {
    const r = lerProposta({ ...base, valor: "", condicao: "  ", prazo: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.erros).sort()).toEqual(["condicao", "prazo", "valor"]);
  });
});

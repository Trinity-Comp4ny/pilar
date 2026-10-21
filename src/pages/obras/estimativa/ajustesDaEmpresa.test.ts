import { describe, expect, it } from "vitest";
import { parametrosDaMigration } from "@/test/estimativaFixtures";
import {
  camposDoItem,
  erroDoAjuste,
  itensDaTabela,
  montarAjuste,
  unidadeDoPreco,
  valorDaEmpresa,
  valorDaReferencia,
} from "./ajustesDaEmpresa";

const parametros = parametrosDaMigration();
const item = (id: keyof typeof parametros.adicionais) => {
  const a = parametros.adicionais[id];
  if (!a) throw new Error(`Sem ${id}`);
  return a;
};
const REGISTRO = { atualizadoEm: "2026-10-21T10:00:00.000Z", atualizadoPor: "u-1" };

describe("camposDoItem", () => {
  it("cada tipo de item pede os campos dele", () => {
    expect(camposDoItem(item("fundacao")).map((c) => [c.caminho, c.tipo])).toEqual([["valor", "percentual"]]);
    expect(camposDoItem(item("piscina")).map((c) => [c.caminho, c.rotulo])).toEqual([["valor", "Valor por m²"]]);
    expect(camposDoItem(item("elevador")).map((c) => c.caminho)).toEqual(["valor"]);
    expect(camposDoItem(item("gourmet")).map((c) => c.caminho)).toEqual([
      "valores.baixo",
      "valores.normal",
      "valores.alto",
    ]);
    expect(camposDoItem(item("marcenaria")).map((c) => [c.caminho, c.tipo])).toEqual([
      ["valores.basica", "percentual"],
      ["valores.completa", "percentual"],
    ]);
    expect(camposDoItem(item("ac12")).map((c) => [c.caminho, c.rotulo])).toEqual([
      ["valor_unitario", "Valor por unidade"],
    ]);
  });

  it("unidade do preço de cada tipo", () => {
    expect(unidadeDoPreco(item("fundacao"))).toBe("% da base");
    expect(unidadeDoPreco(item("paisagismo"))).toBe("m² de área livre");
    expect(unidadeDoPreco(item("arrimo"))).toBe("m² de parede");
    expect(unidadeDoPreco(item("fv"))).toBe("kWp");
    expect(unidadeDoPreco(item("subsolo"))).toBe("item");
  });
});

describe("montarAjuste", () => {
  it("campo simples vira o valor mais o registro", () => {
    const campo = camposDoItem(item("piscina"))[0];
    const ajuste = montarAjuste(item("piscina"), { valor: 3000 }, { ...REGISTRO, observacao: "tabela 2026" });
    expect(ajuste).toEqual({
      valor: 3000,
      observacao: "tabela 2026",
      atualizado_em: REGISTRO.atualizadoEm,
      atualizado_por: "u-1",
    });
    expect(valorDaEmpresa(ajuste, campo)).toBe(3000);
    expect(valorDaReferencia(item("piscina"), campo)).toBe(2500);
  });

  it("grupo de valores sai completo, partindo da referência", () => {
    const ajuste = montarAjuste(item("gourmet"), { "valores.alto": 95_000 }, REGISTRO);
    expect(ajuste.valores).toEqual({ baixo: 25_000, normal: 45_000, alto: 95_000 });
    expect(erroDoAjuste(item("gourmet"), ajuste)).toBeNull();
  });

  it("item a definir guarda o valor por unidade", () => {
    const ajuste = montarAjuste(item("fv"), { valor_unitario: 5200 }, REGISTRO);
    expect(ajuste.valor_unitario).toBe(5200);
    expect(ajuste.observacao).toBeUndefined();
  });
});

describe("erroDoAjuste", () => {
  it("aceita ajuste válido", () => {
    expect(erroDoAjuste(item("piscina"), montarAjuste(item("piscina"), { valor: 3000 }, REGISTRO))).toBeNull();
  });

  it("recusa valor por unidade zero ou negativo", () => {
    expect(erroDoAjuste(item("fv"), { valor_unitario: 0 })).toBe("Informe um valor maior que zero");
    expect(erroDoAjuste(item("fv"), { valor_unitario: -1 })).toBe("Informe um valor maior que zero");
  });

  it("recusa percentual acima de 100 e dinheiro negativo", () => {
    expect(erroDoAjuste(item("fundacao"), { valor: 120 })).toMatch(/Confira os valores/);
    expect(erroDoAjuste(item("piscina"), { valor: -5 })).toMatch(/Confira os valores/);
  });

  it("ajuste só com registro não vale", () => {
    expect(erroDoAjuste(item("piscina"), { observacao: "x", atualizado_em: "y" })).toBe("Informe pelo menos um valor");
  });
});

describe("itensDaTabela", () => {
  it("lista os itens na ordem do catálogo, sem o que o CUB já cobre", () => {
    const dentro = structuredClone(parametros);
    dentro.adicionais.gourmet = { ...dentro.adicionais.gourmet!, escopo: "dentro_do_cub" };
    const ids = itensDaTabela(dentro).map((i) => i.id);
    expect(ids[0]).toBe("fundacao");
    expect(ids).not.toContain("gourmet");
    expect(ids).toContain("acinst");
  });

  it("parâmetro que o banco ainda não tem fica de fora", () => {
    const antigo = structuredClone(parametros);
    delete antigo.adicionais.fv;
    expect(itensDaTabela(antigo).map((i) => i.id)).not.toContain("fv");
  });
});

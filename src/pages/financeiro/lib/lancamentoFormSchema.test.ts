import { describe, expect, it } from "vitest";
import { defaultValues, rateiosValidos, schema } from "./lancamentoFormSchema";

// Regras do schema do formulário de lançamento, isoladas da tela.

const base = {
  descricao: "Honorários",
  valorTotal: "R$ 1.000,00",
  dataVencimento: new Date(2026, 10, 10),
  status: "Pendente",
};

function erros(input: Record<string, unknown>) {
  const r = schema.safeParse({ ...base, ...input });
  if (r.success) return {};
  // Primeira mensagem por campo (é a que o form exibe).
  const out: Record<string, string> = {};
  for (const i of r.error.issues) out[i.path.join(".")] ??= i.message;
  return out;
}

describe("lancamentoFormSchema", () => {
  it("aceita o mínimo válido e aplica os defaults", () => {
    const r = schema.safeParse(base);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.parcelas).toBe("1");
    expect(r.data.recorrente).toBe(false);
    expect(r.data.periodicidade).toBe("mensal");
    expect(r.data.contaId).toBe("");
  });

  it("descrição vazia é obrigatória", () => {
    expect(erros({ descricao: "" })).toEqual({ descricao: "Descrição obrigatória" });
  });

  it("valor vazio é obrigatório", () => {
    expect(erros({ valorTotal: "" })).toMatchObject({ valorTotal: "Valor obrigatório" });
  });

  it.each(["R$ 0,00", "0", "abc", "R$ -0,00"])("valor %s não é maior que zero", (v) => {
    expect(erros({ valorTotal: v })).toEqual({ valorTotal: "Valor deve ser maior que zero" });
  });

  it("valor negativo digitado com sinal é lido como positivo (máscara descarta o sinal)", () => {
    // parseCurrencyString ignora "-": o campo MoneyInput nunca produz negativo.
    expect(erros({ valorTotal: "-R$ 10,00" })).toEqual({});
  });

  it("aceita centavos e valores altos", () => {
    expect(erros({ valorTotal: "R$ 0,01" })).toEqual({});
    expect(erros({ valorTotal: "R$ 99.999.999,99" })).toEqual({});
  });

  it("data de vencimento ausente ou inválida é recusada", () => {
    expect(erros({ dataVencimento: undefined })).toHaveProperty("dataVencimento");
    expect(erros({ dataVencimento: new Date("x") })).toHaveProperty("dataVencimento");
  });

  it.each([
    ["1", true],
    ["60", true],
    ["", true],
    ["0", false],
    ["61", false],
    ["-2", false],
    ["abc", false],
  ])("parcelas %s → válido=%s", (parcelas, ok) => {
    const e = erros({ parcelas });
    if (ok) expect(e).toEqual({});
    else expect(e).toEqual({ parcelas: "Parcelas deve ser entre 1 e 60" });
  });

  it.each(["Pago", "Recebida"])("status %s exige conta ou cartão", (status) => {
    expect(erros({ status })).toEqual({ contaId: "Conta obrigatória para lançamentos efetivados" });
    expect(erros({ status, contaId: "c1" })).toEqual({});
    expect(erros({ status, cartaoId: "k1" })).toEqual({});
  });

  it("Pendente não exige conta", () => {
    expect(erros({ status: "Pendente" })).toEqual({});
  });

  it("conta e cartão ao mesmo tempo é recusado", () => {
    expect(erros({ contaId: "c1", cartaoId: "k1" })).toEqual({ cartaoId: "Selecione apenas Conta OU Cartão" });
  });

  it("defaults do form começam vazios e pendentes para receita e despesa", () => {
    for (const tipo of ["receita", "despesa"] as const) {
      const d = defaultValues(tipo);
      expect(d.status).toBe("Pendente");
      expect(d.valorTotal).toBe("");
      expect(d.descricao).toBe("");
      expect(d.parcelas).toBe("1");
      // Defaults sozinhos não passam: o usuário precisa preencher descrição e valor.
      expect(schema.safeParse(d).success).toBe(false);
    }
  });
});

describe("rateiosValidos", () => {
  const cc = (id: string, p: string) => ({ centro_custo_id: id, percentual: p });

  it("rateio desligado ou vazio não valida nada", () => {
    expect(rateiosValidos(false, [cc("a", "10")])).toEqual([]);
    expect(rateiosValidos(true, [])).toEqual([]);
    expect(rateiosValidos(true, [cc("", ""), cc("b", "")])).toEqual([]);
  });

  it("soma 100 (com casas decimais) passa e descarta linhas incompletas", () => {
    expect(rateiosValidos(true, [cc("a", "33.33"), cc("b", "33.33"), cc("c", "33.34"), cc("", "")])).toHaveLength(3);
  });

  it.each([
    ["90", "0"],
    ["60", "50"],
  ])("soma diferente de 100 lança (%s + %s)", (p1, p2) => {
    expect(() => rateiosValidos(true, [cc("a", p1), cc("b", p2)])).toThrow(
      /Soma dos percentuais do rateio deve ser 100/
    );
  });
});

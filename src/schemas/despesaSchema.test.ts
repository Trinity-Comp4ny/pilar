import { describe, it, expect } from "vitest";
import { despesaSchema } from "./despesaSchema";

const base = {
  dataVencimento: new Date("2026-05-01"),
  descricao: "Aluguel escritório",
  valorTotal: "R$ 2.000,00",
  status: "Pendente" as const,
  parcelas: "1",
  categoriaId: "",
  formaPagamento: "",
  fornecedorId: "",
  projetoID: "",
  notaFiscal: "",
  contaId: "",
  cartaoId: "",
  observacao: "",
  recorrente: false,
  periodicidade: "mensal",
};

describe("despesaSchema", () => {
  it("aceita despesa pendente sem conta nem cartão", () => {
    expect(despesaSchema.safeParse(base).success).toBe(true);
  });

  it("aceita despesa paga com conta", () => {
    const data = { ...base, status: "Pago" as const, contaId: "uuid-conta-1" };
    expect(despesaSchema.safeParse(data).success).toBe(true);
  });

  it("aceita despesa paga com cartão", () => {
    const data = { ...base, status: "Pago" as const, cartaoId: "uuid-cartao-1" };
    expect(despesaSchema.safeParse(data).success).toBe(true);
  });

  it("rejeita despesa paga sem conta nem cartão", () => {
    const data = { ...base, status: "Pago" as const };
    const r = despesaSchema.safeParse(data);
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path.includes("contaId"));
      expect(issue?.message).toContain("Conta");
    }
  });

  it("rejeita conta e cartão preenchidos simultaneamente", () => {
    const data = {
      ...base,
      status: "Pago" as const,
      contaId: "uuid-conta-1",
      cartaoId: "uuid-cartao-1",
    };
    const r = despesaSchema.safeParse(data);
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path.includes("cartaoId"));
      expect(issue?.message).toContain("apenas");
    }
  });

  it("rejeita valor zero", () => {
    expect(despesaSchema.safeParse({ ...base, valorTotal: "R$ 0,00" }).success).toBe(false);
  });

  it("rejeita descrição vazia", () => {
    expect(despesaSchema.safeParse({ ...base, descricao: "" }).success).toBe(false);
  });
});

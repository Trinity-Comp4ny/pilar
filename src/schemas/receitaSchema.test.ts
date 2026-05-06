import { describe, it, expect } from "vitest";
import { receitaSchema } from "./receitaSchema";

const base = {
  dataVencimento: new Date("2026-05-01"),
  descricao: "Consultoria mensal",
  valorTotal: "R$ 5.000,00",
  status: "Pendente" as const,
  parcelas: "1",
  projetoID: "",
  categoriaId: "",
  formaPagamento: "",
  notaFiscal: "",
  contaId: "",
  clienteId: "",
  observacao: "",
  recorrencia: "Nenhuma",
};

describe("receitaSchema", () => {
  it("aceita receita pendente sem conta", () => {
    expect(receitaSchema.safeParse(base).success).toBe(true);
  });

  it("aceita receita recebida com conta preenchida", () => {
    const data = { ...base, status: "Recebida" as const, contaId: "uuid-conta-1" };
    expect(receitaSchema.safeParse(data).success).toBe(true);
  });

  it("rejeita receita recebida sem conta", () => {
    const data = { ...base, status: "Recebida" as const, contaId: "" };
    const r = receitaSchema.safeParse(data);
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path.includes("contaId"));
      expect(issue?.message).toContain("Conta");
    }
  });

  it("rejeita valor zero", () => {
    const data = { ...base, valorTotal: "R$ 0,00" };
    expect(receitaSchema.safeParse(data).success).toBe(false);
  });

  it("rejeita descrição vazia", () => {
    const data = { ...base, descricao: "" };
    expect(receitaSchema.safeParse(data).success).toBe(false);
  });

  it("aceita 12 parcelas", () => {
    const data = { ...base, parcelas: "12" };
    expect(receitaSchema.safeParse(data).success).toBe(true);
  });

  it("rejeita 61 parcelas", () => {
    const data = { ...base, parcelas: "61" };
    expect(receitaSchema.safeParse(data).success).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { calcParcelas, buildDespesaPayloads, buildReceitaPayloads } from "./buildLancamentoPayload";
import type { DespesaFormData } from "@/schemas/despesaSchema";
import type { ReceitaFormData } from "@/schemas/receitaSchema";

const EMPRESA_ID = "empresa-uuid-1";

// new Date(year, month-1, day) usa hora local — evita problema de timezone com "2026-05-01" UTC
const baseDespesa: DespesaFormData = {
  dataVencimento: new Date(2026, 4, 1),
  descricao: "Aluguel",
  valorTotal: "R$ 3.000,00",
  status: "Pendente",
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

const baseReceita: ReceitaFormData = {
  dataVencimento: new Date(2026, 4, 1),
  descricao: "Contrato XYZ",
  valorTotal: "R$ 6.000,00",
  status: "Pendente",
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

// ─── calcParcelas ─────────────────────────────────────────────────────────────

describe("calcParcelas", () => {
  it("retorna array com 1 elemento igual ao valor total", () => {
    expect(calcParcelas(1000, 1)).toEqual([1000]);
  });

  it("distribui igualmente quando divisível", () => {
    expect(calcParcelas(300, 3)).toEqual([100, 100, 100]);
  });

  it("última parcela absorve arredondamento", () => {
    const result = calcParcelas(100, 3);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe(result[1]);
    const soma = result.reduce((a, b) => a + b, 0);
    expect(Math.round(soma * 100)).toBe(10000);
  });

  it("mantém 2 casas decimais em cada parcela", () => {
    const result = calcParcelas(10, 3);
    result.forEach((v) => {
      const decimals = (v.toString().split(".")[1] ?? "").length;
      expect(decimals).toBeLessThanOrEqual(2);
    });
  });

  it("funciona com valor muito pequeno", () => {
    const result = calcParcelas(0.03, 3);
    const soma = Math.round(result.reduce((a, b) => a + b, 0) * 100);
    expect(soma).toBe(3);
  });
});

// ─── buildDespesaPayloads ─────────────────────────────────────────────────────

describe("buildDespesaPayloads — despesa pendente", () => {
  it("gera 1 payload com status Pendente e data_pagamento null", () => {
    const [p] = buildDespesaPayloads({ formData: baseDespesa, empresaId: EMPRESA_ID });
    expect(p.status).toBe("Pendente");
    expect(p.data_pagamento).toBeNull();
  });

  it("empresa_id é propagado corretamente", () => {
    const [p] = buildDespesaPayloads({ formData: baseDespesa, empresaId: EMPRESA_ID });
    expect(p.empresa_id).toBe(EMPRESA_ID);
  });

  it("1 parcela não gera grupo_parcela nem parcela_numero", () => {
    const [p] = buildDespesaPayloads({ formData: baseDespesa, empresaId: EMPRESA_ID });
    expect(p.grupo_parcela).toBeNull();
    expect(p.parcela_numero).toBeNull();
    expect(p.parcela_total).toBeNull();
  });

  it("descricao sem sufixo de parcela quando numParcelas = 1", () => {
    const [p] = buildDespesaPayloads({ formData: baseDespesa, empresaId: EMPRESA_ID });
    expect(p.descricao).toBe("Aluguel");
  });
});

describe("buildDespesaPayloads — despesa paga", () => {
  const pago: DespesaFormData = { ...baseDespesa, status: "Pago", contaId: "conta-1" };

  it("status é Pago e data_pagamento é preenchida", () => {
    const [p] = buildDespesaPayloads({ formData: pago, empresaId: EMPRESA_ID });
    expect(p.status).toBe("Pago");
    expect(p.data_pagamento).toBe("2026-05-01");
  });
});

describe("buildDespesaPayloads — parcelamento", () => {
  const parcelada: DespesaFormData = { ...baseDespesa, parcelas: "3" };

  it("gera 3 payloads", () => {
    const rows = buildDespesaPayloads({ formData: parcelada, empresaId: EMPRESA_ID });
    expect(rows).toHaveLength(3);
  });

  it("todos compartilham o mesmo grupo_parcela", () => {
    const rows = buildDespesaPayloads({ formData: parcelada, empresaId: EMPRESA_ID });
    const grupoId = rows[0].grupo_parcela;
    expect(grupoId).not.toBeNull();
    rows.forEach((r) => expect(r.grupo_parcela).toBe(grupoId));
  });

  it("parcela_numero sequencial começando em 1", () => {
    const rows = buildDespesaPayloads({ formData: parcelada, empresaId: EMPRESA_ID });
    expect(rows[0].parcela_numero).toBe(1);
    expect(rows[1].parcela_numero).toBe(2);
    expect(rows[2].parcela_numero).toBe(3);
  });

  it("parcela_total é igual ao número de parcelas", () => {
    const rows = buildDespesaPayloads({ formData: parcelada, empresaId: EMPRESA_ID });
    rows.forEach((r) => expect(r.parcela_total).toBe(3));
  });

  it("datas de vencimento incrementam mensalmente", () => {
    const rows = buildDespesaPayloads({ formData: parcelada, empresaId: EMPRESA_ID });
    expect(rows[0].data_vencimento).toBe("2026-05-01");
    expect(rows[1].data_vencimento).toBe("2026-06-01");
    expect(rows[2].data_vencimento).toBe("2026-07-01");
  });

  it("descrições têm sufixo (n/total)", () => {
    const rows = buildDespesaPayloads({ formData: parcelada, empresaId: EMPRESA_ID });
    expect(rows[0].descricao).toBe("Aluguel (1/3)");
    expect(rows[1].descricao).toBe("Aluguel (2/3)");
    expect(rows[2].descricao).toBe("Aluguel (3/3)");
  });

  it("soma dos valores é igual ao total", () => {
    const rows = buildDespesaPayloads({ formData: parcelada, empresaId: EMPRESA_ID });
    const soma = rows.reduce((acc, r) => acc + (r.valor as number), 0);
    expect(Math.round(soma * 100)).toBe(300000);
  });

  it("parcelas pendentes não têm data_pagamento", () => {
    const rows = buildDespesaPayloads({ formData: parcelada, empresaId: EMPRESA_ID });
    rows.forEach((r) => expect(r.data_pagamento).toBeNull());
  });
});

describe("buildDespesaPayloads — edição preserva grupo_parcela original", () => {
  it("herda grupo_parcela e parcela_numero do registro existente", () => {
    const selected = { grupo_parcela: "grupo-original", parcela_numero: 2, parcela_total: 3 };
    const [p] = buildDespesaPayloads({ formData: baseDespesa, empresaId: EMPRESA_ID, selectedParcela: selected });
    expect(p.grupo_parcela).toBe("grupo-original");
    expect(p.parcela_numero).toBe(2);
    expect(p.parcela_total).toBe(3);
  });
});

describe("buildDespesaPayloads — recorrência", () => {
  it("sem recorrência: recorrente=false e periodicidade=null", () => {
    const [p] = buildDespesaPayloads({ formData: baseDespesa, empresaId: EMPRESA_ID });
    expect(p.recorrente).toBe(false);
    expect(p.periodicidade).toBeNull();
  });

  it("com recorrência: periodicidade propagada", () => {
    const recorrente: DespesaFormData = { ...baseDespesa, recorrente: true, periodicidade: "semanal" };
    const [p] = buildDespesaPayloads({ formData: recorrente, empresaId: EMPRESA_ID });
    expect(p.recorrente).toBe(true);
    expect(p.periodicidade).toBe("semanal");
  });
});

// ─── buildReceitaPayloads ─────────────────────────────────────────────────────

describe("buildReceitaPayloads — receita pendente", () => {
  it("status Pendente e data_recebimento null", () => {
    const [p] = buildReceitaPayloads({ formData: baseReceita, empresaId: EMPRESA_ID });
    expect(p.status).toBe("Pendente");
    expect(p.data_recebimento).toBeNull();
  });

  it("empresa_id propagado", () => {
    const [p] = buildReceitaPayloads({ formData: baseReceita, empresaId: EMPRESA_ID });
    expect(p.empresa_id).toBe(EMPRESA_ID);
  });

  it("1 parcela sem grupo_parcela", () => {
    const [p] = buildReceitaPayloads({ formData: baseReceita, empresaId: EMPRESA_ID });
    expect(p.grupo_parcela).toBeNull();
    expect(p.parcela_numero).toBeNull();
  });
});

describe("buildReceitaPayloads — receita recebida", () => {
  const recebida: ReceitaFormData = { ...baseReceita, status: "Recebida", contaId: "conta-1" };

  it("status Recebido e data_recebimento preenchida", () => {
    const [p] = buildReceitaPayloads({ formData: recebida, empresaId: EMPRESA_ID });
    expect(p.status).toBe("Recebido");
    expect(p.data_recebimento).toBe("2026-05-01");
  });
});

describe("buildReceitaPayloads — parcelamento", () => {
  const parcelada: ReceitaFormData = { ...baseReceita, parcelas: "2" };

  it("gera 2 payloads com datas mensais", () => {
    const rows = buildReceitaPayloads({ formData: parcelada, empresaId: EMPRESA_ID });
    expect(rows).toHaveLength(2);
    expect(rows[0].data_vencimento).toBe("2026-05-01");
    expect(rows[1].data_vencimento).toBe("2026-06-01");
  });

  it("soma dos valores é igual ao total", () => {
    const rows = buildReceitaPayloads({ formData: parcelada, empresaId: EMPRESA_ID });
    const soma = rows.reduce((acc, r) => acc + (r.valor as number), 0);
    expect(Math.round(soma * 100)).toBe(600000);
  });

  it("grupo_parcela compartilhado entre parcelas", () => {
    const rows = buildReceitaPayloads({ formData: parcelada, empresaId: EMPRESA_ID });
    expect(rows[0].grupo_parcela).toBe(rows[1].grupo_parcela);
    expect(rows[0].grupo_parcela).not.toBeNull();
  });
});

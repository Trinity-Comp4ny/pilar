import { describe, expect, it } from "vitest";
import { buildVariableData } from "./docxUtils";

const propostaBase = {
  titulo: "Proposta teste",
  codigo: "PROP-001",
  area_m2: 100,
  localizacao: "São Paulo",
  valor_proposto: 50000,
  prazo_estimado_dias: 90,
  validade: "2026-12-31",
  observacao: "",
};

describe("buildVariableData — níveis de detalhe das disciplinas (spec 069)", () => {
  it("DISCIPLINAS continua só a lista de nomes separados por vírgula", () => {
    const data = buildVariableData({
      proposta: propostaBase,
      disciplinas: [
        { disciplina: "Estrutural", horas_estimadas: 80, custo_hora: 150, valor_venda: 12000 },
        { disciplina: "Elétrico", horas_estimadas: 40, custo_hora: 120, valor_venda: 4800 },
      ],
    });
    expect(data.DISCIPLINAS).toBe("Estrutural, Elétrico");
  });

  it("DISCIPLINAS_FASES lista uma disciplina por linha, só o nome", () => {
    const data = buildVariableData({
      proposta: propostaBase,
      disciplinas: [
        { disciplina: "Estrutural", horas_estimadas: 80, custo_hora: 150, valor_venda: 12000 },
        { disciplina: "Elétrico", horas_estimadas: 40, custo_hora: 120, valor_venda: 4800 },
      ],
    });
    expect(data.DISCIPLINAS_FASES).toBe("Estrutural\nElétrico");
  });

  it("DISCIPLINAS_COM_VALOR mostra nome e valor formatado em R$ por linha", () => {
    const data = buildVariableData({
      proposta: propostaBase,
      disciplinas: [
        { disciplina: "Estrutural", horas_estimadas: 80, custo_hora: 150, valor_venda: 12000 },
        { disciplina: "Elétrico", horas_estimadas: 40, custo_hora: 120, valor_venda: 8500 },
      ],
    });
    expect(data.DISCIPLINAS_COM_VALOR).toContain("Estrutural");
    expect(data.DISCIPLINAS_COM_VALOR).toContain("R$");
    expect(data.DISCIPLINAS_COM_VALOR.split("\n")).toHaveLength(2);
  });

  it("DISCIPLINAS_DETALHADO mostra nome, horas, custo/hora e valor", () => {
    const data = buildVariableData({
      proposta: propostaBase,
      disciplinas: [{ disciplina: "Estrutural", horas_estimadas: 80, custo_hora: 150, valor_venda: 12000 }],
    });
    expect(data.DISCIPLINAS_DETALHADO).toContain("Estrutural");
    expect(data.DISCIPLINAS_DETALHADO).toContain("80h");
  });

  it("sem valor_venda, calcula horas × custo_hora", () => {
    const data = buildVariableData({
      proposta: propostaBase,
      disciplinas: [{ disciplina: "Hidráulico", horas_estimadas: 50, custo_hora: 100 }],
    });
    // 50h x R$100 = R$5.000,00
    expect(data.DISCIPLINAS_COM_VALOR).toContain("5.000,00");
  });

  it("proposta sem disciplinas: as três variáveis novas ficam vazias, sem erro", () => {
    const data = buildVariableData({ proposta: propostaBase });
    expect(data.DISCIPLINAS_FASES).toBe("");
    expect(data.DISCIPLINAS_COM_VALOR).toBe("");
    expect(data.DISCIPLINAS_DETALHADO).toBe("");
  });
});

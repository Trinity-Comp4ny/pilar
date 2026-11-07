import { describe, expect, it } from "vitest";
import { disciplinasDoDocumento } from "./disciplinasDocumento";

describe("disciplinasDoDocumento", () => {
  it("leva o valor de venda para o documento", () => {
    expect(
      disciplinasDoDocumento([{ disciplina: "Estrutural", horas_estimadas: 10, custo_hora: 100, valor_venda: 5000 }])
    ).toEqual([{ disciplina: "Estrutural", horas_estimadas: 10, custo_hora: 100, valor_venda: 5000 }]);
  });

  it("sem valor de venda salvo, deixa indefinido (proposta antiga)", () => {
    const [d] = disciplinasDoDocumento([
      { disciplina: "MEP", horas_estimadas: null, custo_hora: null, valor_venda: null },
    ]);
    expect(d.valor_venda).toBeUndefined();
    expect(d.horas_estimadas).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { calcMargemPrometida } from "./useMargemPrometida";

describe("calcMargemPrometida", () => {
  it("é nula sem orçamento por disciplina", () => {
    expect(calcMargemPrometida([])).toBeNull();
    expect(calcMargemPrometida([{ margem_alvo_pct: null, valor_venda: 100 }])).toBeNull();
  });

  it("pondera pelo valor de venda", () => {
    const r = calcMargemPrometida([
      { margem_alvo_pct: 30, valor_venda: 9000 },
      { margem_alvo_pct: 10, valor_venda: 1000 },
    ]);
    expect(r).toBeCloseTo(28, 5);
  });

  it("sem valor de venda usa a média simples", () => {
    expect(
      calcMargemPrometida([
        { margem_alvo_pct: 30, valor_venda: 0 },
        { margem_alvo_pct: 20, valor_venda: null },
      ])
    ).toBeCloseTo(25, 5);
  });
});

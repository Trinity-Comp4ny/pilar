import { describe, expect, it } from "vitest";
import { saldoDaCompra } from "./saldoOrcamento";

const no = (id: string, parent_id: string | null, nivel: string, nome: string) => ({
  id,
  parent_id,
  nivel,
  nome,
  ordem: 0,
  created_at: "2026-01-01",
});
const nos = [no("f", null, "fase", "Estrutura"), no("e", "f", "etapa", "Fundação"), no("s", "e", "servico", "Brocas")];

describe("saldoDaCompra", () => {
  it("sem frente ou sem orçado no caminho não há saldo", () => {
    expect(saldoDaCompra(null, 100, nos, new Map(), {})).toBeNull();
    expect(saldoDaCompra("s", 100, nos, new Map(), {})).toBeNull();
  });

  it("sobe até o ancestral com orçado e desconta o realizado dos descendentes", () => {
    const r = saldoDaCompra("s", 300, nos, new Map([["e", 3000]]), { s: 2000 });
    expect(r).toMatchObject({ caminho: "Estrutura › Fundação", previsto: 3000, realizado: 2000, saldoAntes: 1000 });
    expect(r?.saldoApos).toBe(700);
    expect(r?.estoura).toBe(false);
  });

  it("compra maior que o saldo estoura", () => {
    const r = saldoDaCompra("e", 1500, nos, new Map([["e", 3000]]), { s: 2000 });
    expect(r?.saldoApos).toBe(-500);
    expect(r?.estoura).toBe(true);
  });
});

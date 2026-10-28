import { describe, expect, it } from "vitest";
import { montarLinhasAgrupadas } from "./lancamentosRows";
import type { Lancamento } from "../hooks/useLancamentosUnified";

// BEZ-442: ao expandir um plano parcelado, as parcelas de outros meses precisam aparecer,
// senão só a do mês fica visível e as demais não podem ser editadas.

const parcela = (id: string, numero: number, status = "Pendente", grupo = "g1"): Lancamento =>
  ({
    id,
    tipo: "receita",
    descricao: `Honorários (${numero}/4)`,
    valor: 1000,
    status,
    data_vencimento: `2026-${String(7 + numero).padStart(2, "0")}-10`,
    parcela_numero: numero,
    parcela_total: 4,
    grupo_parcela: grupo,
  }) as Lancamento;

const avulso = {
  id: "x",
  tipo: "despesa",
  descricao: "Café",
  valor: 10,
  status: "Pago",
  grupo_parcela: null,
} as Lancamento;

const plano = new Map([["g1", [1, 2, 3, 4].map((n) => parcela(`p${n}`, n, n < 3 ? "Recebido" : "Pendente"))]]);

describe("montarLinhasAgrupadas", () => {
  it("só a parcela do período: o grupo recolhido resume e não lista filhos", () => {
    const linhas = montarLinhasAgrupadas([parcela("p4", 4)], new Set(), plano);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ kind: "group", groupId: "g1" });
  });

  it("expandido, mostra o plano inteiro em ordem, inclusive as parcelas de outros meses", () => {
    const linhas = montarLinhasAgrupadas([parcela("p4", 4)], new Set(["g1"]), plano);
    const filhos = linhas.filter((l) => l.kind === "item").map((l) => (l.kind === "item" ? l.data.id : ""));
    expect(filhos).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("a parcela do período não duplica com a cópia do plano", () => {
    const linhas = montarLinhasAgrupadas([parcela("p3", 3), parcela("p4", 4)], new Set(["g1"]), plano);
    expect(linhas.filter((l) => l.kind === "item")).toHaveLength(4);
  });

  it("sem o plano carregado ainda, expande só com o que está no período", () => {
    const linhas = montarLinhasAgrupadas([parcela("p4", 4)], new Set(["g1"]));
    expect(linhas.filter((l) => l.kind === "item")).toHaveLength(1);
  });

  it("lançamento avulso segue como linha comum, na ordem original", () => {
    const linhas = montarLinhasAgrupadas([avulso, parcela("p4", 4)], new Set(), plano);
    expect(linhas.map((l) => l.kind)).toEqual(["item", "group"]);
  });

  it("dois planos viram dois grupos", () => {
    const linhas = montarLinhasAgrupadas([parcela("p4", 4), parcela("q2", 2, "Pendente", "g2")], new Set());
    expect(linhas.filter((l) => l.kind === "group").map((l) => (l.kind === "group" ? l.groupId : ""))).toEqual([
      "g1",
      "g2",
    ]);
  });
});

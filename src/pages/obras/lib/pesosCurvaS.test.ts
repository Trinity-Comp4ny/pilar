import { describe, expect, it } from "vitest";
import { pesosPorTarefa } from "./pesosCurvaS";

describe("pesosPorTarefa", () => {
  it("divide o orçado da frente igualmente entre as tarefas dela", () => {
    const pesos = pesosPorTarefa(
      [
        { id: "a", obra_frente_id: "f1" },
        { id: "b", obra_frente_id: "f1" },
        { id: "c", obra_frente_id: "f2" },
      ],
      new Map([
        ["f1", 100],
        ["f2", 40],
      ])
    );
    expect(pesos.get("a")).toBe(50);
    expect(pesos.get("b")).toBe(50);
    expect(pesos.get("c")).toBe(40);
  });

  it("tarefa sem orçado pesa a média das demais", () => {
    const pesos = pesosPorTarefa(
      [
        { id: "a", obra_frente_id: "f1" },
        { id: "b", obra_frente_id: null },
      ],
      new Map([["f1", 80]])
    );
    expect(pesos.get("b")).toBe(80);
  });

  it("sem nenhum orçado devolve vazio (a curva volta a contar tarefas)", () => {
    expect(pesosPorTarefa([{ id: "a", obra_frente_id: "f1" }], new Map()).size).toBe(0);
  });
});

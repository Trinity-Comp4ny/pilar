import { describe, expect, it } from "vitest";
import { ordenarKanban, parseKanbanSort, type KanbanSortAccessors } from "./kanbanSort";

type Item = { id: string; peso?: number; prazo?: string | null; valor?: number | null; nome: string };

const acc: KanbanSortAccessors<Item> = {
  priority: (i) => i.peso,
  dueDate: (i) => i.prazo,
  value: (i) => i.valor,
  name: (i) => i.nome,
};

const ids = (l: Item[]) => l.map((i) => i.id);

describe("ordenarKanban", () => {
  const itens: Item[] = [
    { id: "a", peso: 2, prazo: "2026-10-20", valor: 100, nome: "Zeta" },
    { id: "b", peso: 0, prazo: null, valor: null, nome: "alfa" },
    { id: "c", peso: 1, prazo: "2026-10-10", valor: 300, nome: "Beta" },
  ];

  it("prioridade crescente põe a alta (peso 0) primeiro", () => {
    expect(ids(ordenarKanban(itens, { key: "priority", dir: "asc" }, acc))).toEqual(["b", "c", "a"]);
    expect(ids(ordenarKanban(itens, { key: "priority", dir: "desc" }, acc))).toEqual(["a", "c", "b"]);
  });

  it("sem data ou sem valor vai para o fim nas duas direções", () => {
    expect(ids(ordenarKanban(itens, { key: "dueDate", dir: "asc" }, acc))).toEqual(["c", "a", "b"]);
    expect(ids(ordenarKanban(itens, { key: "dueDate", dir: "desc" }, acc))).toEqual(["a", "c", "b"]);
    expect(ids(ordenarKanban(itens, { key: "value", dir: "desc" }, acc))).toEqual(["c", "a", "b"]);
  });

  it("nome ignora caixa e acento da ordem alfabética", () => {
    expect(ids(ordenarKanban(itens, { key: "name", dir: "asc" }, acc))).toEqual(["b", "c", "a"]);
  });

  it("empate mantém a ordem de entrada", () => {
    const iguais: Item[] = [
      { id: "x", peso: 1, nome: "x" },
      { id: "y", peso: 1, nome: "y" },
    ];
    expect(ids(ordenarKanban(iguais, { key: "priority", dir: "asc" }, acc))).toEqual(["x", "y"]);
    expect(ids(ordenarKanban(iguais, { key: "priority", dir: "desc" }, acc))).toEqual(["x", "y"]);
  });

  it("criação sem leitor usa a ordem do servidor e inverte em asc", () => {
    expect(ids(ordenarKanban(itens, { key: "created", dir: "desc" }, acc))).toEqual(["a", "b", "c"]);
    expect(ids(ordenarKanban(itens, { key: "created", dir: "asc" }, acc))).toEqual(["c", "b", "a"]);
  });

  it("não muta a lista original", () => {
    const copia = [...itens];
    ordenarKanban(itens, { key: "name", dir: "desc" }, acc);
    expect(itens).toEqual(copia);
  });
});

describe("parseKanbanSort", () => {
  const padrao = { key: "priority", dir: "asc" } as const;

  it("lê chave.direção", () => {
    expect(parseKanbanSort("dueDate.desc", padrao)).toEqual({ key: "dueDate", dir: "desc" });
  });

  it("valor inválido ou ausente cai no padrão", () => {
    expect(parseKanbanSort("nada.torto", padrao)).toEqual(padrao);
    expect(parseKanbanSort(null, padrao)).toEqual(padrao);
  });
});

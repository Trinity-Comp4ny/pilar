import { describe, expect, it } from "vitest";
import { ordenarKanban } from "@/lib/kanbanSort";
import { TAREFAS_SORT_ACESSORES } from "./ordenacao";
import type { ItemTrabalho } from "./useItensTrabalho";

const item = (titulo: string, prioridade: ItemTrabalho["prioridade"], prazo: string | null): ItemTrabalho =>
  ({ titulo, prioridade, prazo }) as ItemTrabalho;

const itens = [
  item("media A", "media", "2026-11-01"),
  item("baixa", "baixa", "2026-10-01"),
  item("alta tarde", "alta", "2026-12-01"),
  item("alta cedo", "alta", "2026-10-15"),
  item("media B", "media", null),
];

const titulos = (lista: ItemTrabalho[]) => lista.map((i) => i.titulo);

// Feedback da VRZ (17/10): "as tarefas de prioridade alta devem vir primeiro".
describe("ordenação das tarefas por prioridade", () => {
  it("alta primeiro, e quem empata mantém a ordem de entrada", () => {
    const lista = ordenarKanban(itens, { key: "priority", dir: "asc" }, TAREFAS_SORT_ACESSORES);
    expect(titulos(lista)).toEqual(["alta tarde", "alta cedo", "media A", "media B", "baixa"]);
  });

  it("baixa primeiro na direção inversa", () => {
    const lista = ordenarKanban(itens, { key: "priority", dir: "desc" }, TAREFAS_SORT_ACESSORES);
    expect(titulos(lista)[0]).toBe("baixa");
  });

  it("por prazo, sem prazo vai para o fim", () => {
    const lista = ordenarKanban(itens, { key: "dueDate", dir: "asc" }, TAREFAS_SORT_ACESSORES);
    expect(titulos(lista)).toEqual(["baixa", "alta cedo", "media A", "alta tarde", "media B"]);
  });
});

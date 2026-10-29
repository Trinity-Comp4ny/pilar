import { describe, expect, it } from "vitest";
import { compararPorPrioridade, idsParaGravar, moverNaLista, projetoTemDisciplinaDaPessoa } from "./ordemPrioridade";
import { type Projeto } from "@/types/projetos";

const p = (id: string, ordem: number | null, inicio = "2026-11-01") => ({
  id,
  nome: `Projeto ${id}`,
  data_inicio: inicio,
  ordem_prioridade: ordem,
});

describe("compararPorPrioridade", () => {
  it("ordena pela ordem de prioridade e manda quem não tem ordem para o fim", () => {
    const lista = [p("c", null), p("b", 2), p("a", 1)].sort(compararPorPrioridade);
    expect(lista.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("sem ordem, desempata pela data de início e depois pelo nome", () => {
    const lista = [p("z", null, "2026-12-01"), p("y", null, "2026-10-01"), p("x", null, "2026-10-01")].sort(
      compararPorPrioridade
    );
    expect(lista.map((x) => x.id)).toEqual(["x", "y", "z"]);
  });
});

describe("moverNaLista", () => {
  it("move o item e não altera a lista original", () => {
    const original = ["a", "b", "c"];
    expect(moverNaLista(original, 2, 0)).toEqual(["c", "a", "b"]);
    expect(original).toEqual(["a", "b", "c"]);
  });

  it("devolve a mesma lista quando a posição não muda ou é inválida", () => {
    const lista = ["a", "b"];
    expect(moverNaLista(lista, 1, 1)).toBe(lista);
    expect(moverNaLista(lista, 5, 0)).toBe(lista);
  });
});

describe("idsParaGravar", () => {
  it("põe os escondidos depois dos visíveis, na ordem em que já estavam", () => {
    const todos = [p("a", 1), p("b", 2), p("c", 3), p("d", null)];
    const visiveisNovaOrdem = [p("b", 2), p("a", 1)];
    expect(idsParaGravar(visiveisNovaOrdem, todos)).toEqual(["b", "a", "c", "d"]);
  });
});

describe("projetoTemDisciplinaDaPessoa", () => {
  const projeto = (disciplinas: unknown) => ({ disciplinas }) as Pick<Projeto, "disciplinas">;

  it("vale para o responsável principal e para os responsáveis extras", () => {
    expect(projetoTemDisciplinaDaPessoa(projeto([{ responsavel_id: "ju" }]), "ju")).toBe(true);
    expect(
      projetoTemDisciplinaDaPessoa(projeto([{ responsavel_id: "x", responsaveis: [{ responsavel_id: "ju" }] }]), "ju")
    ).toBe(true);
  });

  it("não vale para projeto sem disciplina da pessoa", () => {
    expect(projetoTemDisciplinaDaPessoa(projeto([{ responsavel_id: "x" }]), "ju")).toBe(false);
    expect(projetoTemDisciplinaDaPessoa(projeto([]), "ju")).toBe(false);
  });
});

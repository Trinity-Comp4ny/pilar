import { describe, expect, it } from "vitest";
import { idsMencionados, mencionaTodos, segmentarMencoes } from "./mencoes";

const pessoas = [
  { id: "p1", nome: "Larissa Favero" },
  { id: "p2", nome: "Larissa" },
  { id: "p3", nome: "Flávio (Obra)" },
];

describe("segmentarMencoes", () => {
  it("separa texto comum e menções com o id da pessoa", () => {
    expect(segmentarMencoes("@Larissa Favero liberado para detalhamento", pessoas)).toEqual([
      { texto: "@Larissa Favero", pessoaId: "p1" },
      { texto: " liberado para detalhamento", pessoaId: null },
    ]);
  });

  it("prefere o nome mais longo quando um é prefixo do outro", () => {
    const segs = segmentarMencoes("oi @Larissa e @Larissa Favero", pessoas);
    expect(segs.filter((s) => s.pessoaId).map((s) => s.pessoaId)).toEqual(["p2", "p1"]);
  });

  it("escapa caractere especial de regex no nome", () => {
    expect(segmentarMencoes("@Flávio (Obra) viu", pessoas)[0]).toEqual({ texto: "@Flávio (Obra)", pessoaId: "p3" });
  });

  it("sem pessoas, devolve o texto inteiro sem menção", () => {
    expect(segmentarMencoes("@Alguém", [])).toEqual([{ texto: "@Alguém", pessoaId: null }]);
  });

  it("reconhece @all e @todos como marcação de todos", () => {
    expect(segmentarMencoes("@all reunião às 9h", pessoas)[0]).toEqual({ texto: "@all", pessoaId: null, todos: true });
    expect(segmentarMencoes("oi @Todos", [])[1]).toEqual({ texto: "@Todos", pessoaId: null, todos: true });
  });

  it("não trata @allan nem e-mail como @all", () => {
    expect(segmentarMencoes("@allan viu", [])).toEqual([{ texto: "@allan viu", pessoaId: null }]);
    expect(segmentarMencoes("joao@all.com", [])).toEqual([{ texto: "joao@all.com", pessoaId: null }]);
  });

  it("pessoa chamada Allan ou Todos ganha da palavra reservada", () => {
    expect(segmentarMencoes("@Todos", [{ id: "p9", nome: "Todos" }])[0]).toEqual({ texto: "@Todos", pessoaId: "p9" });
  });
});

describe("idsMencionados", () => {
  it("acha quem foi digitado inteiro, sem repetir, com o nome mais longo primeiro", () => {
    expect(idsMencionados("@Larissa Favero e @Larissa Favero, depois @Flávio (Obra)", pessoas)).toEqual(["p1", "p3"]);
  });

  it("ignora @ sem nome conhecido e @all", () => {
    expect(idsMencionados("@Fulano @all", pessoas)).toEqual([]);
  });
});

describe("mencionaTodos", () => {
  it("detecta @all e @todos em qualquer ponto do texto", () => {
    expect(mencionaTodos("pessoal, @all prazo mudou")).toBe(true);
    expect(mencionaTodos("@TODOS")).toBe(true);
  });

  it("não detecta sem a marcação", () => {
    expect(mencionaTodos("todos viram? @Larissa")).toBe(false);
    expect(mencionaTodos("@allan")).toBe(false);
  });
});

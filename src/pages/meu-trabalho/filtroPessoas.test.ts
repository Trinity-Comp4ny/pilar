import { describe, expect, it } from "vitest";
import { resolverPessoaIds } from "./filtroPessoas";

describe("resolverPessoaIds", () => {
  it("sem ninguém marcado não filtra (mostra tarefa de todos e sem responsável)", () => {
    expect(resolverPessoaIds({ filtroPessoas: [], minhaPessoaId: "p1" })).toBeNull();
    expect(resolverPessoaIds({ filtroPessoas: [], minhaPessoaId: null })).toBeNull();
  });

  it("'eu' vira a própria pessoa e soma com as outras marcadas", () => {
    expect(resolverPessoaIds({ filtroPessoas: ["eu"], minhaPessoaId: "p1" })).toEqual(["p1"]);
    expect(resolverPessoaIds({ filtroPessoas: ["eu", "p2"], minhaPessoaId: "p1" })).toEqual(["p1", "p2"]);
  });

  it("filtra por outra pessoa sem incluir a própria", () => {
    expect(resolverPessoaIds({ filtroPessoas: ["p2"], minhaPessoaId: "p1" })).toEqual(["p2"]);
  });

  it("'eu' sem pessoa vinculada mantém o filtro ativo e vazio", () => {
    expect(resolverPessoaIds({ filtroPessoas: ["eu"], minhaPessoaId: null })).toEqual([]);
  });
});

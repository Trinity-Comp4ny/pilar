import { describe, expect, it } from "vitest";
import { podeExcluirComentario } from "./comentarios";

const eu = { id: "u-eu", role: "colaborador", nomes: ["Larissa Favero", undefined] };

describe("podeExcluirComentario", () => {
  it("admin e coordenador apagam qualquer comentário", () => {
    const alheio = { autor: "Outra Pessoa", autorId: "u-outro" };
    expect(podeExcluirComentario(alheio, { ...eu, role: "admin" })).toBe(true);
    expect(podeExcluirComentario(alheio, { ...eu, role: "ultra_admin" })).toBe(true);
    expect(podeExcluirComentario(alheio, { ...eu, role: "coordenador" })).toBe(true);
  });

  it("colaborador apaga só o próprio, pelo id", () => {
    expect(podeExcluirComentario({ autor: "Larissa Favero", autorId: "u-eu" }, eu)).toBe(true);
    expect(podeExcluirComentario({ autor: "Larissa Favero", autorId: "u-outro" }, eu)).toBe(false);
    expect(podeExcluirComentario({ autor: "Outra", autorId: "u-outro" }, { ...eu, role: "user" })).toBe(false);
  });

  it("comentário antigo sem id cai na comparação por nome", () => {
    expect(podeExcluirComentario({ autor: " larissa favero " }, eu)).toBe(true);
    expect(podeExcluirComentario({ autor: "Outra Pessoa" }, eu)).toBe(false);
    expect(podeExcluirComentario({ autor: "" }, { ...eu, nomes: [""] })).toBe(false);
  });

  it("sem usuário identificado não apaga o alheio", () => {
    expect(podeExcluirComentario({ autor: "X", autorId: "u-x" }, { id: null, role: null, nomes: [] })).toBe(false);
  });
});

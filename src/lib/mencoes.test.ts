import { describe, expect, it } from "vitest";
import { segmentarMencoes } from "./mencoes";

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
});

import { describe, expect, it } from "vitest";
import { pessoasValidas, separarMedicoes, sessaoVencida } from "./registrarDiaRegras";

describe("pessoasValidas", () => {
  it("aceita inteiro positivo, com espaço em volta", () => {
    expect(pessoasValidas("3")).toBe(3);
    expect(pessoasValidas(" 12 ")).toBe(12);
  });

  it("recusa zero, negativo, fração, texto e vazio", () => {
    for (const q of ["0", "-2", "2,5", "2.5", "dez", "", "   "]) expect(pessoasValidas(q)).toBeNull();
  });
});

describe("separarMedicoes", () => {
  it("ignora linha incompleta e normaliza as completas", () => {
    const r = separarMedicoes([
      { item: " Reboco ", quantidade: "12.5", unidade: " m² " },
      { item: "", quantidade: "", unidade: "" },
      { item: "Pintura", quantidade: "3", unidade: "" },
    ]);
    expect(r.invalida).toBeNull();
    expect(r.validas).toEqual([{ item: "Reboco", quantidade: 12.5, unidade: "m²", enviada: false }]);
  });

  it("aponta a primeira medição com quantidade que não é número positivo", () => {
    const r = separarMedicoes([
      { item: "Reboco", quantidade: "muitos", unidade: "m²" },
      { item: "Piso", quantidade: "0", unidade: "m²" },
    ]);
    expect(r.invalida?.item).toBe("Reboco");
  });
});

describe("sessaoVencida", () => {
  it("só a recusa de sessão leva ao login", () => {
    expect(sessaoVencida("Sessão inválida")).toBe(true);
    expect(sessaoVencida("Obra concluída")).toBe(false);
    expect(sessaoVencida(undefined)).toBe(false);
  });
});

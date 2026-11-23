import { describe, expect, it } from "vitest";
import { FILTRO_VAZIO, filtrarExtrato, filtroAtivo } from "./filtroExtrato";

const l = (tipo: string, descricao: string, fornecedor_id: string | null = null) => ({
  tipo,
  descricao,
  fornecedor_id,
});
const extrato = [l("aporte", "Aporte inicial"), l("despesa", "Cimento CP-II", "f1"), l("despesa", "Areia média", "f2")];

describe("filtrarExtrato", () => {
  it("sem filtro devolve tudo", () => {
    expect(filtrarExtrato(extrato, FILTRO_VAZIO)).toHaveLength(3);
    expect(filtroAtivo(FILTRO_VAZIO)).toBe(false);
  });

  it("filtra por tipo e por fornecedor", () => {
    expect(filtrarExtrato(extrato, { ...FILTRO_VAZIO, tipo: "despesa" })).toHaveLength(2);
    expect(filtrarExtrato(extrato, { ...FILTRO_VAZIO, fornecedorId: "f1" }).map((x) => x.descricao)).toEqual([
      "Cimento CP-II",
    ]);
  });

  it("busca ignora acento e caixa", () => {
    expect(filtrarExtrato(extrato, { ...FILTRO_VAZIO, busca: "MEDIA" }).map((x) => x.descricao)).toEqual([
      "Areia média",
    ]);
    expect(filtroAtivo({ ...FILTRO_VAZIO, busca: "x" })).toBe(true);
  });

  it("combina os filtros", () => {
    expect(filtrarExtrato(extrato, { tipo: "aporte", fornecedorId: "f1", busca: "" })).toEqual([]);
  });
});

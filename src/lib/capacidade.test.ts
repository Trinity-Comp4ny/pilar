import { describe, it, expect } from "vitest";
import { parseCapacidadeError } from "./capacidade";

describe("parseCapacidadeError", () => {
  it("reconhece capacidade:projetos com limite no hint", () => {
    expect(parseCapacidadeError({ message: "capacidade:projetos", hint: "2" })).toEqual({
      recurso: "projetos",
      limite: 2,
    });
  });

  it("reconhece capacidade:obras com limite no hint", () => {
    expect(parseCapacidadeError({ message: "capacidade:obras", hint: "1" })).toEqual({
      recurso: "obras",
      limite: 1,
    });
  });

  it("sem hint, limite vem null (nível ilimitado ou hint ausente)", () => {
    expect(parseCapacidadeError({ message: "capacidade:projetos" })).toEqual({
      recurso: "projetos",
      limite: null,
    });
  });

  it("erro não relacionado a capacidade devolve null", () => {
    expect(parseCapacidadeError({ message: "duplicate key value" })).toBeNull();
    expect(parseCapacidadeError(new Error("algo deu errado"))).toBeNull();
    expect(parseCapacidadeError(null)).toBeNull();
    expect(parseCapacidadeError(undefined)).toBeNull();
  });

  it("recurso fora da lista conhecida (ex: capacidade:usuarios) devolve null", () => {
    expect(parseCapacidadeError({ message: "capacidade:usuarios", hint: "2" })).toBeNull();
  });
});

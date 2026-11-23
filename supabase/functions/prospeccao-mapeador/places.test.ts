import { describe, expect, it } from "vitest";
import { consultaTexto, mapearLugares, normalizarTelefone } from "./places";

describe("normalizarTelefone", () => {
  it("celular com DDD", () => {
    expect(normalizarTelefone("(11) 99999-0000")).toEqual({ e164: "5511999990000", tipo: "celular" });
  });
  it("fixo internacional", () => {
    expect(normalizarTelefone("+55 14 3433-0000")).toEqual({ e164: "551434330000", tipo: "fixo" });
  });
  it("rejeita número curto e vazio", () => {
    expect(normalizarTelefone("3433-0000")).toBeNull();
    expect(normalizarTelefone(null)).toBeNull();
  });
});

describe("mapearLugares", () => {
  it("deduplica, descarta fechado e sem nome", () => {
    const r = mapearLugares([
      {
        id: "a",
        displayName: { text: "Estúdio Teste" },
        nationalPhoneNumber: "(11) 99999-0000",
        businessStatus: "OPERATIONAL",
      },
      { id: "a", displayName: { text: "Duplicado" } },
      { id: "b", displayName: { text: "Fechado" }, businessStatus: "CLOSED_PERMANENTLY" },
      { id: "c", displayName: { text: "  " } },
      { id: "d", displayName: { text: "Sem telefone" } },
    ]);
    expect(r.map((l) => l.place_id)).toEqual(["a", "d"]);
    expect(r[0].tipo_telefone).toBe("celular");
    expect(r[1].tipo_telefone).toBe("sem");
  });
});

describe("consultaTexto", () => {
  it("monta a busca", () => {
    expect(consultaTexto("escritório de arquitetura", "Marília", "SP")).toBe(
      "escritório de arquitetura em Marília, SP"
    );
  });
});

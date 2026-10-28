import { describe, expect, it } from "vitest";
import { contaDisciplinasAbertas, diasDePausa, empurrarData, mensagemDaPausa } from "./pausa";

describe("diasDePausa", () => {
  it("conta dias de calendário", () => {
    expect(diasDePausa("2026-10-14T12:00:00", new Date("2026-10-28T09:00:00"))).toBe(14);
  });

  it("pausar e retomar no mesmo dia dá 0", () => {
    expect(diasDePausa("2026-10-28T08:00:00", new Date("2026-10-28T18:00:00"))).toBe(0);
  });

  it("nunca devolve negativo", () => {
    expect(diasDePausa("2026-10-30T08:00:00", new Date("2026-10-28T18:00:00"))).toBe(0);
  });
});

describe("empurrarData", () => {
  it("avança pelos dias parados", () => {
    expect(empurrarData("2026-10-20", 14)).toBe("2026-11-03");
  });

  it("atravessa o fim do ano", () => {
    expect(empurrarData("2026-12-15", 14)).toBe("2026-12-29");
    expect(empurrarData("2026-12-25", 14)).toBe("2027-01-08");
  });

  it("data vazia continua vazia", () => {
    expect(empurrarData(null, 14)).toBeNull();
    expect(empurrarData(undefined, 14)).toBeNull();
  });
});

describe("contaDisciplinasAbertas", () => {
  it("ignora concluídas e já pausadas", () => {
    expect(contaDisciplinasAbertas(["Em Andamento", "Não Iniciado", "Concluído", "Pausada", null])).toBe(3);
  });

  it("lista vazia dá 0", () => {
    expect(contaDisciplinasAbertas([])).toBe(0);
  });
});

describe("mensagemDaPausa", () => {
  it("usa o texto do banco quando é erro de regra (P0001)", () => {
    expect(mensagemDaPausa({ code: "P0001", message: "Projeto já está pausado" }, "padrão")).toBe(
      "Projeto já está pausado"
    );
  });

  it("erro de rede ou permissão cai no texto padrão", () => {
    expect(mensagemDaPausa({ code: "42501", message: "permission denied" }, "padrão")).toBe("padrão");
    expect(mensagemDaPausa(new Error("Failed to fetch"), "padrão")).toBe("padrão");
    expect(mensagemDaPausa(null, "padrão")).toBe("padrão");
  });
});

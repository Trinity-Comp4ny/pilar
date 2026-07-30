import { describe, expect, it } from "vitest";
import { calcularAvanco, climaLabel, condicaoLabel, STATUS_OBRA_OPCOES } from "./obras";
import { statusLabel } from "./status";

describe("calcularAvanco", () => {
  it("é 0 quando não há tarefas", () => {
    expect(calcularAvanco([])).toBe(0);
  });

  it("é 25% com 1 de 4 concluídas (critério de aceite spec 015)", () => {
    const tarefas = [{ status: "concluida" }, { status: "a_fazer" }, { status: "fazendo" }, { status: "a_fazer" }];
    expect(calcularAvanco(tarefas)).toBe(25);
  });

  it("é 100% quando todas concluídas", () => {
    expect(calcularAvanco([{ status: "concluida" }, { status: "concluida" }])).toBe(100);
  });

  it("arredonda para inteiro", () => {
    // 1 de 3 = 33.33 -> 33
    expect(calcularAvanco([{ status: "concluida" }, { status: "a_fazer" }, { status: "a_fazer" }])).toBe(33);
  });
});

describe("labels de RDO", () => {
  it("traduz clima e condição conhecidos", () => {
    expect(climaLabel("chuva_forte")).toBe("Chuva forte");
    expect(condicaoLabel("paralisada")).toBe("Obra paralisada");
  });

  it("devolve vazio para nulo", () => {
    expect(climaLabel(null)).toBe("");
    expect(condicaoLabel(undefined)).toBe("");
  });
});

describe("status de obra no registry", () => {
  it("todo status de opção resolve label no domínio obra", () => {
    for (const opt of STATUS_OBRA_OPCOES) {
      expect(statusLabel("obra", opt.value)).toBe(opt.label);
    }
  });
});

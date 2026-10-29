import { describe, it, expect } from "vitest";
import { Bell } from "lucide-react";
import {
  CATEGORIAS,
  rotuloCategoria,
  iconeCategoria,
  resolveLink,
  formatTimeAgo,
  toneSeveridade,
  SEVERIDADE_TONE,
  emailPadraoCategoria,
  contarPorCategoria,
  condicoesTipoPortal,
  tipoPortal,
} from "./notificacoes";

describe("emailPadraoCategoria", () => {
  it("liga financeiro, projeto, disciplina e obra; desliga tarefa e desconhecidas", () => {
    expect(["financeiro", "projeto", "disciplina", "obra"].every(emailPadraoCategoria)).toBe(true);
    expect(emailPadraoCategoria("tarefa")).toBe(false);
    expect(emailPadraoCategoria("sistema")).toBe(false);
    expect(emailPadraoCategoria("qualquer")).toBe(false);
  });
});

describe("rotuloCategoria", () => {
  it("tem rótulo para toda categoria conhecida", () => {
    for (const c of CATEGORIAS) {
      expect(rotuloCategoria(c)).toBeTruthy();
    }
  });
  it("cai no fallback para categoria desconhecida", () => {
    expect(rotuloCategoria("qualquer_coisa")).toBe("Notificação");
  });
});

describe("iconeCategoria", () => {
  it("resolve um ícone para categoria conhecida", () => {
    expect(iconeCategoria("tarefa")).toBeTruthy();
  });
  it("cai no ícone Bell para categoria desconhecida", () => {
    expect(iconeCategoria("desconhecida")).toBe(Bell);
  });
});

describe("toneSeveridade", () => {
  it("mapeia severidades conhecidas", () => {
    expect(toneSeveridade("critical")).toBe(SEVERIDADE_TONE.critical);
  });
  it("cai em medium para severidade desconhecida", () => {
    expect(toneSeveridade("xpto")).toBe(SEVERIDADE_TONE.medium);
  });
});

describe("resolveLink", () => {
  it("devolve o link quando existe", () => {
    expect(resolveLink({ link: "/projetos/1" })).toBe("/projetos/1");
  });
  it("devolve null quando ausente ou vazio", () => {
    expect(resolveLink({ link: null })).toBeNull();
    expect(resolveLink({ link: "  " })).toBeNull();
    expect(resolveLink({})).toBeNull();
  });
});

describe("formatTimeAgo", () => {
  const base = new Date("2026-08-12T12:00:00Z").getTime();
  it("mostra 'agora' abaixo de 1 minuto", () => {
    expect(formatTimeAgo("2026-08-12T11:59:30Z", base)).toBe("agora");
  });
  it("mostra minutos", () => {
    expect(formatTimeAgo("2026-08-12T11:45:00Z", base)).toBe("15min");
  });
  it("mostra horas", () => {
    expect(formatTimeAgo("2026-08-12T09:00:00Z", base)).toBe("3h");
  });
  it("mostra dias", () => {
    expect(formatTimeAgo("2026-08-10T12:00:00Z", base)).toBe("2d");
  });
});

describe("contarPorCategoria", () => {
  it("soma por categoria, incluindo desconhecidas", () => {
    const itens = [{ categoria: "financeiro" }, { categoria: "financeiro" }, { categoria: "obra" }, { categoria: "x" }];
    expect(contarPorCategoria(itens)).toEqual({ financeiro: 2, obra: 1, x: 1 });
  });
  it("devolve objeto vazio sem itens", () => {
    expect(contarPorCategoria([])).toEqual({});
  });
});

describe("tipoPortal", () => {
  it("separa problema e sugestão pelo título e cadastro pelo tipo", () => {
    expect(tipoPortal({ tipo: "feedback_recebido", titulo: "Problema relatado" })).toBe("problema");
    expect(tipoPortal({ tipo: "feedback_recebido", titulo: "Sugestão: filtro por cliente" })).toBe("sugestao");
    expect(tipoPortal({ tipo: "novo_cadastro", titulo: "Nova empresa" })).toBe("cadastro");
    expect(tipoPortal({ tipo: "plano_bloqueado", titulo: "Plano bloqueado" })).toBe("outros");
  });
});

describe("condicoesTipoPortal", () => {
  it("sem tipo não filtra", () => {
    expect(condicoesTipoPortal(null)).toEqual([]);
  });
  it("problema e sugestão filtram tipo e título; outros exclui feedback e cadastro", () => {
    expect(condicoesTipoPortal("problema")).toEqual([
      { coluna: "tipo", operador: "eq", valor: "feedback_recebido" },
      { coluna: "titulo", operador: "eq", valor: "Problema relatado" },
    ]);
    expect(condicoesTipoPortal("sugestao")[1]).toEqual({ coluna: "titulo", operador: "like", valor: "Sugestão:*" });
    expect(condicoesTipoPortal("outros")).toEqual([
      { coluna: "tipo", operador: "not.in", valor: "(feedback_recebido,novo_cadastro)" },
    ]);
  });
});

describe("rotuloCategoria do portal", () => {
  it("chama sistema de Portal", () => {
    expect(rotuloCategoria("sistema")).toBe("Portal");
  });
});

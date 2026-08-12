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
} from "./notificacoes";

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

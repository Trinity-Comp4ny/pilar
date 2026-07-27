import { describe, expect, it } from "vitest";
import {
  STATUS_REGISTRY,
  TONE_BADGE,
  TONE_COLUMN,
  statusBadgeClasses,
  statusColumnClasses,
  statusDef,
  statusLabel,
} from "./status";

describe("registry de status", () => {
  it("todo status registrado resolve para um tom com classe definida", () => {
    for (const [domain, statuses] of Object.entries(STATUS_REGISTRY)) {
      for (const [status, def] of Object.entries(statuses)) {
        expect(TONE_BADGE[def.tone], `${domain}/${status}`).toBeTruthy();
        expect(TONE_COLUMN[def.tone], `${domain}/${status}`).toBeTruthy();
      }
    }
  });

  it("Pago e Recebido têm a MESMA cor (critério da spec 003)", () => {
    expect(statusBadgeClasses("financeiro", "Pago")).toBe(statusBadgeClasses("financeiro", "Recebido"));
    expect(statusBadgeClasses("financeiro", "Pago")).toBe(TONE_BADGE.positive);
  });

  it("nenhum tom usa paleta crua Tailwind (só tokens semânticos)", () => {
    const cru = /(?:bg|text|border)-(?:emerald|red|green|amber|yellow|blue|purple|gray|slate)-\d/;
    for (const classes of [...Object.values(TONE_BADGE), ...Object.values(TONE_COLUMN)]) {
      expect(classes).not.toMatch(cru);
    }
  });

  it("status desconhecido cai em neutral com o próprio nome como label", () => {
    expect(statusDef("financeiro", "Inexistente")).toEqual({ label: "Inexistente", tone: "neutral" });
    expect(statusLabel("financeiro", "Inexistente")).toBe("Inexistente");
    expect(statusBadgeClasses("financeiro", "Inexistente")).toBe(TONE_BADGE.neutral);
  });

  it("mapa de leads preserva as cores que a página já usava (era o único em tokens)", () => {
    expect(statusBadgeClasses("lead", "Novo")).toBe("bg-info-soft text-info-strong");
    expect(statusBadgeClasses("lead", "Em contato")).toBe("bg-highlight-soft text-highlight-strong");
    expect(statusBadgeClasses("lead", "Ganho")).toBe("bg-positive/10 text-positive-strong");
    expect(statusBadgeClasses("lead", "Perdido")).toBe("bg-danger-soft text-danger-strong");
  });

  it("colunas do kanban de projeto seguem o mesmo tom do badge", () => {
    expect(statusColumnClasses("projeto", "Concluído")).toBe(TONE_COLUMN.done);
    expect(statusColumnClasses("projeto", "Paralisado")).toBe(TONE_COLUMN.brand);
  });
});

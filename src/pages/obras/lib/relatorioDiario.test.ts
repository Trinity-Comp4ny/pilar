import { describe, expect, it } from "vitest";
import type { RdoRow } from "@/pages/obras/hooks/useObraRdo";
import { periodoPadrao, periodoValido, rdosDoPeriodo, textoDoRelatorio } from "./relatorioDiario";

const rdo = (data: string, extra: Partial<RdoRow> = {}) => ({ id: data, data, ...extra }) as RdoRow;

describe("relatorioDiario", () => {
  it("o período padrão são os últimos 7 dias, contando hoje", () => {
    expect(periodoPadrao(new Date("2026-11-19T12:00:00Z"))).toEqual({ de: "2026-11-13", ate: "2026-11-19" });
  });

  it("recusa período incompleto ou invertido", () => {
    expect(periodoValido({ de: "", ate: "2026-11-19" })).toBe(false);
    expect(periodoValido({ de: "2026-11-20", ate: "2026-11-19" })).toBe(false);
    expect(periodoValido({ de: "2026-11-19", ate: "2026-11-19" })).toBe(true);
  });

  it("filtra inclusive nas pontas e ordena do mais antigo ao mais novo", () => {
    const r = rdosDoPeriodo([rdo("2026-11-18"), rdo("2026-11-10"), rdo("2026-11-13"), rdo("2026-11-20")], {
      de: "2026-11-13",
      ate: "2026-11-18",
    });
    expect(r.map((x) => x.data)).toEqual(["2026-11-13", "2026-11-18"]);
    expect(rdosDoPeriodo([rdo("2026-11-13")], { de: "2026-11-19", ate: "2026-11-13" })).toEqual([]);
  });

  it("monta o texto de compartilhar e avisa quando não há registro", () => {
    const p = { de: "2026-11-13", ate: "2026-11-14" };
    expect(textoDoRelatorio("Casa Alfa", p, [])).toContain("Sem registros no período.");
    const t = textoDoRelatorio("Casa Alfa", p, [rdo("2026-11-13", { atividades: "Laje", pendencias: "Aço" })]);
    expect(t).toContain("Diário de obra · Casa Alfa");
    expect(t).toContain("13/11/2026 a 14/11/2026");
    expect(t).toContain("Atividades: Laje");
    expect(t).toContain("Pendências: Aço");
    expect(t).not.toContain("Ocorrências");
  });
});

import { describe, expect, it } from "vitest";
import { isUltraAdminPath, rotaDaAbaLegada, ultraSecaoAtiva } from "./ultraAdminNav";

describe("ultraAdminNav", () => {
  it("reconhece rotas do portal", () => {
    expect(isUltraAdminPath("/ultra-admin")).toBe(true);
    expect(isUltraAdminPath("/ultra-admin/empresas/123")).toBe(true);
    expect(isUltraAdminPath("/ultra-adminx")).toBe(false);
    expect(isUltraAdminPath("/admin")).toBe(false);
  });

  it("marca a seção pela rota, detalhe de empresa fica em Empresas", () => {
    expect(ultraSecaoAtiva("/ultra-admin")).toBe("visao-geral");
    expect(ultraSecaoAtiva("/ultra-admin/")).toBe("visao-geral");
    expect(ultraSecaoAtiva("/ultra-admin/empresas")).toBe("empresas");
    expect(ultraSecaoAtiva("/ultra-admin/empresas/abc")).toBe("empresas");
    expect(ultraSecaoAtiva("/ultra-admin/custos-ia")).toBe("custos-ia");
    expect(ultraSecaoAtiva("/projetos")).toBeNull();
  });

  it("ficha do agente marca o agente, não a Central do time", () => {
    expect(ultraSecaoAtiva("/ultra-admin/time")).toBe("time");
    expect(ultraSecaoAtiva("/ultra-admin/time/receita")).toBe("time-receita");
    expect(ultraSecaoAtiva("/ultra-admin/time/clientes/")).toBe("time-clientes");
  });

  it("leva os links antigos ?tab= pra rota nova", () => {
    expect(rotaDaAbaLegada("trials")).toBe("/ultra-admin/testes");
    expect(rotaDaAbaLegada("feedback")).toBe("/ultra-admin/feedback");
    expect(rotaDaAbaLegada("empresas")).toBe("/ultra-admin/empresas");
    expect(rotaDaAbaLegada("status")).toBe("/ultra-admin/incidentes");
    expect(rotaDaAbaLegada("tokens")).toBe("/ultra-admin/custos-ia");
    expect(rotaDaAbaLegada("dashboard")).toBe("/ultra-admin");
    expect(rotaDaAbaLegada("xyz")).toBeNull();
    expect(rotaDaAbaLegada(null)).toBeNull();
  });
});

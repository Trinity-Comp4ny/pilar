import { describe, it, expect } from "vitest";
import { dashboardForRole, isContractRole, CONTRACT_ROLES } from "./rbac";

describe("isContractRole", () => {
  it("reconhece os papéis do contrato", () => {
    expect(isContractRole("owner")).toBe(true);
    expect(isContractRole("coordenador")).toBe(true);
    expect(isContractRole("colaborador")).toBe(true);
  });

  it("não reconhece papéis legados nem lixo", () => {
    expect(isContractRole("admin")).toBe(false);
    expect(isContractRole("user")).toBe(false);
    expect(isContractRole("ultra_admin")).toBe(false);
    expect(isContractRole(null)).toBe(false);
    expect(isContractRole(undefined)).toBe(false);
    expect(isContractRole("")).toBe(false);
  });

  it("o contrato tem exatamente os três papéis acordados com o Cluster 1", () => {
    expect([...CONTRACT_ROLES]).toEqual(["owner", "coordenador", "colaborador"]);
  });
});

describe("dashboardForRole", () => {
  it("mapeia cada papel do contrato para sua casa", () => {
    expect(dashboardForRole("owner")).toBe("/inicio");
    expect(dashboardForRole("coordenador")).toBe("/inicio");
    expect(dashboardForRole("colaborador")).toBe("/inicio");
  });

  it("manda papel autenticado desconhecido/legado para o início", () => {
    expect(dashboardForRole("admin")).toBe("/inicio");
    expect(dashboardForRole("user")).toBe("/inicio");
  });

  it("manda não-autenticado para o login", () => {
    expect(dashboardForRole(null)).toBe("/login");
    expect(dashboardForRole(undefined)).toBe("/login");
  });
});

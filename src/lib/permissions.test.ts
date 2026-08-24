import { describe, expect, it } from "vitest";
import { canDo, reasonFor } from "./permissions";
import type { CompanyFeatures } from "./features";
import type { UserRole } from "./permissions";

/**
 * Acesso é role + módulo habilitado na empresa (ADR 0029). O eixo por usuário
 * (profiles.features) não existe mais: era ele que deixava um admin recém
 * convidado sem acesso a nada, com a UI mostrando botões que a RLS negava.
 */
const ctx = (role: UserRole | null, companyFeatures: CompanyFeatures = {}) => ({ role, companyFeatures });

describe("canDo", () => {
  it("membro sem nenhuma feature concedida usa e escreve no que é universal", () => {
    expect(canDo(ctx("user"), "projetos", "view")).toBe(true);
    expect(canDo(ctx("user"), "projetos", "edit")).toBe(true);
    expect(canDo(ctx("user"), "financeiro", "delete")).toBe(true);
  });

  it("admin idem, sem depender de JSONB nenhum", () => {
    expect(canDo(ctx("admin"), "clientes", "edit")).toBe(true);
  });

  it("feature dormant continua exigindo o early access da empresa", () => {
    expect(canDo(ctx("user"), "timesheet", "view")).toBe(false);
    expect(canDo(ctx("user", { timesheet: true }), "timesheet", "edit")).toBe(true);
  });

  it("ultra_admin passa em tudo, inclusive no que a empresa não tem", () => {
    expect(canDo(ctx("ultra_admin" as UserRole), "ai_hub", "manage")).toBe(true);
  });

  it("sem role não há acesso", () => {
    expect(canDo(ctx(null), "projetos", "view")).toBe(false);
    expect(canDo(null, "projetos", "view")).toBe(false);
  });

  it("admin_portal e billing seguem por role", () => {
    expect(canDo(ctx("admin"), "admin_portal")).toBe(true);
    expect(canDo(ctx("user"), "admin_portal")).toBe(false);
    expect(canDo(ctx("user"), "billing")).toBe(false);
  });

  it("core vale mesmo com a empresa sem nada habilitado", () => {
    expect(canDo(ctx("user"), "dashboard", "view")).toBe(true);
    expect(canDo(ctx("user"), "meu_trabalho", "edit")).toBe(true);
  });
});

describe("reasonFor", () => {
  it("explica por empresa, não por nível de usuário", () => {
    expect(reasonFor("timesheet")).toContain("não está habilitado para esta empresa");
  });

  it("pseudo-feature fala de perfil", () => {
    expect(reasonFor("admin_portal")).toContain("Admin");
  });
});

import { describe, expect, it } from "vitest";
import { canDo, reasonFor } from "./permissions";
import type { CompanyFeatures } from "./features";
import type { UserRole } from "./permissions";

/**
 * Acesso é role + módulo habilitado na empresa (ADR 0029). O eixo por usuário
 * (profiles.features) não existe mais: era ele que deixava um admin recém
 * convidado sem acesso a nada, com a UI mostrando botões que a RLS negava.
 *
 * 'financeiro' e 'financeiro_folha' são exceção (ADR 0034): não seguem mais
 * o toggle de módulo da empresa, decidem por role + financeiroDelegado.
 */
const ctx = (
  role: UserRole | null,
  companyFeatures: CompanyFeatures = {},
  financeiroDelegado = false
) => ({ role, companyFeatures, financeiroDelegado });

describe("canDo", () => {
  it("membro sem nenhuma feature concedida usa e escreve no que é universal", () => {
    expect(canDo(ctx("user"), "projetos", "view")).toBe(true);
    expect(canDo(ctx("user"), "projetos", "edit")).toBe(true);
  });

  it("admin idem, sem depender de JSONB nenhum", () => {
    expect(canDo(ctx("admin"), "clientes", "edit")).toBe(true);
  });

  it("feature dormant continua exigindo o early access da empresa", () => {
    expect(canDo(ctx("user"), "timesheet", "view")).toBe(false);
    expect(canDo(ctx("user", { timesheet: true }), "timesheet", "edit")).toBe(true);
  });

  it("ultra_admin passa em tudo, inclusive no que a empresa não tem", () => {
    expect(canDo(ctx("ultra_admin" as UserRole), "timesheet", "manage")).toBe(true);
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

describe("canDo — financeiro delegado (ADR 0034)", () => {
  it("admin vê financeiro e folha sem precisar de delegação", () => {
    expect(canDo(ctx("admin"), "financeiro", "view")).toBe(true);
    expect(canDo(ctx("admin"), "financeiro_folha", "view")).toBe(true);
  });

  it("user sem delegação não vê financeiro nem folha", () => {
    expect(canDo(ctx("user"), "financeiro", "view")).toBe(false);
    expect(canDo(ctx("user"), "financeiro_folha", "view")).toBe(false);
  });

  it("coordenador sem delegação não vê financeiro por padrão", () => {
    expect(canDo(ctx("coordenador" as UserRole), "financeiro", "view")).toBe(false);
  });

  it("coordenador com financeiroDelegado vê financeiro geral, mas nunca folha", () => {
    const delegado = ctx("coordenador" as UserRole, {}, true);
    expect(canDo(delegado, "financeiro", "view")).toBe(true);
    expect(canDo(delegado, "financeiro_folha", "view")).toBe(false);
  });

  it("ultra_admin passa em financeiro e folha sem delegação", () => {
    expect(canDo(ctx("ultra_admin" as UserRole), "financeiro_folha", "view")).toBe(true);
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

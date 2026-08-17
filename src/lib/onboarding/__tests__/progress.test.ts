import { describe, it, expect } from "vitest";
import { ONBOARDING_STEPS } from "@/lib/onboarding/steps";
import { deriveProgress, filterVisibleSteps } from "@/lib/onboarding/progress";
import type { Feature } from "@/lib/permissions";

const allowAll = (_: Feature) => true;
const deny = (features: Feature[]) => (f: Feature) => !features.includes(f);

describe("filterVisibleSteps", () => {
  it("admin com todas as features vê todos os passos", () => {
    const steps = filterVisibleSteps(ONBOARDING_STEPS, allowAll, true);
    expect(steps).toHaveLength(ONBOARDING_STEPS.length);
  });

  it("sem a feature obras, nenhum passo de Obras aparece", () => {
    const steps = filterVisibleSteps(ONBOARDING_STEPS, deny(["obras"]), true);
    expect(steps.some((s) => s.pilar === "obras")).toBe(false);
    expect(steps.some((s) => s.pilar === "gestao")).toBe(true);
  });

  it("não-admin não vê passos adminOnly (equipe)", () => {
    const steps = filterVisibleSteps(ONBOARDING_STEPS, allowAll, false);
    expect(steps.some((s) => s.key === "equipe")).toBe(false);
    // passos não-admin seguem visíveis
    expect(steps.some((s) => s.key === "cliente")).toBe(true);
  });
});

describe("deriveProgress", () => {
  it("marca concluído quando a contagem da fonte é > 0", () => {
    const steps = filterVisibleSteps(ONBOARDING_STEPS, allowAll, true);
    const d = deriveProgress(steps, { pessoas: 3, clientes: 1 });
    expect(d.steps.find((s) => s.key === "equipe")?.done).toBe(true);
    expect(d.steps.find((s) => s.key === "cliente")?.done).toBe(true);
    expect(d.steps.find((s) => s.key === "projeto")?.done).toBe(false);
    expect(d.doneSteps).toBe(2);
  });

  it("sem obras, não cria a seção Obras", () => {
    const steps = filterVisibleSteps(ONBOARDING_STEPS, deny(["obras"]), true);
    const d = deriveProgress(steps, {});
    expect(d.sections.map((s) => s.pilar)).not.toContain("obras");
    expect(d.sections.map((s) => s.pilar)).toEqual(["gestao", "projetos"]);
  });

  it("nextStep é o primeiro passo obrigatório pendente", () => {
    const steps = filterVisibleSteps(ONBOARDING_STEPS, allowAll, true);
    // equipe já feito → próximo obrigatório é cliente
    const d = deriveProgress(steps, { pessoas: 1 });
    expect(d.nextStep?.key).toBe("cliente");
  });

  it("nextStep pula obrigatórios feitos e cai em opcional só se não há obrigatório pendente", () => {
    const steps = filterVisibleSteps(ONBOARDING_STEPS, deny(["obras"]), true);
    // todos obrigatórios de gestao+projetos feitos (pessoas, clientes, projetos)
    const d = deriveProgress(steps, { pessoas: 1, clientes: 1, projetos: 1 });
    expect(d.nextStep?.opcional).toBe(true);
    expect(d.allRequiredDone).toBe(true);
    expect(d.allDone).toBe(false);
  });

  it("allDone quando todos os passos visíveis têm contagem", () => {
    const steps = filterVisibleSteps(ONBOARDING_STEPS, deny(["obras"]), true);
    const d = deriveProgress(steps, {
      pessoas: 1,
      clientes: 1,
      lancamentos: 1,
      projetos: 1,
      fluxos_disciplinas: 1,
    });
    expect(d.allDone).toBe(true);
    expect(d.percent).toBe(100);
    expect(d.nextStep).toBeNull();
  });
});

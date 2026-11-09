import { describe, it, expect } from "vitest";
import { ONBOARDING_STEPS, ordemDosPilares } from "@/lib/onboarding/steps";
import { deriveProgress, filterVisibleSteps } from "@/lib/onboarding/progress";
import type { Feature } from "@/lib/permissions";

const allowAll = (_: Feature) => true;
const deny = (features: Feature[]) => (f: Feature) => !features.includes(f);
const fatos = (counts: Record<string, number> = {}, avatar_url: string | null = null) => ({
  counts,
  perfil: { avatar_url },
});

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

  it("convidado não vê passos de admin, mas vê os pilares e a própria conta", () => {
    const steps = filterVisibleSteps(ONBOARDING_STEPS, allowAll, false);
    expect(steps.some((s) => s.key === "colega")).toBe(false);
    expect(steps.some((s) => s.key === "equipe")).toBe(false);
    expect(steps.some((s) => s.key === "foto")).toBe(true);
    expect(steps.some((s) => s.key === "cliente")).toBe(true);
    expect(steps.some((s) => s.key === "obra")).toBe(true);
  });

  it("os três pilares têm passo obrigatório", () => {
    for (const pilar of ["gestao", "projetos", "obras"] as const) {
      expect(ONBOARDING_STEPS.some((s) => s.pilar === pilar && !s.opcional)).toBe(true);
    }
  });

  it("Gestão começa por cliente e proposta", () => {
    const gestao = ONBOARDING_STEPS.filter((s) => s.pilar === "gestao" && !s.opcional).map((s) => s.key);
    expect(gestao).toEqual(["cliente", "proposta"]);
  });
});

describe("deriveProgress", () => {
  const todos = filterVisibleSteps(ONBOARDING_STEPS, allowAll, true);

  it("'Entre no Pilar' já vem feito: ninguém começa do zero", () => {
    const d = deriveProgress(todos, fatos());
    expect(d.steps.find((s) => s.key === "conta")?.done).toBe(true);
    expect(d.doneSteps).toBe(1);
  });

  it("marca concluído quando a contagem atinge o mínimo", () => {
    const d = deriveProgress(todos, fatos({ clientes: 1, profiles: 1 }));
    expect(d.steps.find((s) => s.key === "cliente")?.done).toBe(true);
    // convidar colega exige 2 pessoas ativas (o dono é a primeira)
    expect(d.steps.find((s) => s.key === "colega")?.done).toBe(false);
    expect(deriveProgress(todos, fatos({ profiles: 2 })).steps.find((s) => s.key === "colega")?.done).toBe(true);
  });

  it("projeto de exemplo não conta: a contagem do projeto é a sem exemplo", () => {
    expect(deriveProgress(todos, fatos({ projetos: 1 })).steps.find((s) => s.key === "projeto")?.done).toBe(false);
    expect(
      deriveProgress(todos, fatos({ "projetos:sem_exemplo": 1 })).steps.find((s) => s.key === "projeto")?.done
    ).toBe(true);
  });

  it("foto vem do próprio perfil", () => {
    expect(deriveProgress(todos, fatos({}, "https://x/a.png")).steps.find((s) => s.key === "foto")?.done).toBe(true);
  });

  it("sem obras, não cria a seção Obras", () => {
    const steps = filterVisibleSteps(ONBOARDING_STEPS, deny(["obras"]), true);
    const d = deriveProgress(steps, fatos());
    expect(d.sections.map((s) => s.pilar)).toEqual(["conta", "gestao", "projetos"]);
  });

  it("o pilar escolhido vem logo depois de 'Sua conta' e define o próximo passo", () => {
    const d = deriveProgress(todos, fatos({ profiles: 2 }), ordemDosPilares("obras"));
    expect(d.sections.map((s) => s.pilar)).toEqual(["conta", "obras", "gestao", "projetos"]);
    expect(d.nextStep?.key).toBe("obra");
  });

  it("sem escolha, a ordem é Gestão, Projetos, Obras", () => {
    expect(ordemDosPilares(null)).toEqual(["conta", "gestao", "projetos", "obras"]);
    const d = deriveProgress(todos, fatos({ profiles: 2 }));
    expect(d.nextStep?.key).toBe("cliente");
  });

  it("nextStep cai em opcional só quando não há obrigatório pendente", () => {
    const d = deriveProgress(
      todos,
      fatos({ profiles: 2, clientes: 1, propostas: 1, "projetos:sem_exemplo": 1, obras: 1 })
    );
    expect(d.allRequiredDone).toBe(true);
    expect(d.nextStep?.opcional).toBe(true);
    expect(d.allDone).toBe(false);
  });

  it("allDone quando todos os passos visíveis estão feitos", () => {
    const steps = filterVisibleSteps(ONBOARDING_STEPS, deny(["obras"]), false);
    const d = deriveProgress(
      steps,
      fatos(
        { clientes: 1, propostas: 1, lancamentos: 1, "projetos:sem_exemplo": 1, fluxos_disciplinas: 1 },
        "https://x/a.png"
      )
    );
    expect(d.allDone).toBe(true);
    expect(d.percent).toBe(100);
    expect(d.nextStep).toBeNull();
  });
});

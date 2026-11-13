import { describe, it, expect } from "vitest";
import { ONBOARDING_STEPS, ordemDosPilares, ordemTopologica, prerequisitosObrigatorios } from "@/lib/onboarding/steps";
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

  it("Gestão começa por cliente e equipe, depois proposta e a conta bancária", () => {
    const gestao = ONBOARDING_STEPS.filter((s) => s.pilar === "gestao" && !s.opcional).map((s) => s.key);
    expect(gestao).toEqual(["cliente", "equipe", "proposta", "conta_bancaria"]);
  });
});

describe("deriveProgress", () => {
  const todos = filterVisibleSteps(ONBOARDING_STEPS, allowAll, true);

  it("'Entre na Pilar' já vem feito: ninguém começa do zero", () => {
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
    const d = deriveProgress(todos, fatos({ profiles: 2, clientes: 1 }), ordemDosPilares("obras"));
    expect(d.sections.map((s) => s.pilar)).toEqual(["conta", "obras", "gestao", "projetos"]);
    expect(d.nextStep?.key).toBe("obra");
    // Sem cliente, a obra está bloqueada: o próximo passo é o pré-requisito, não a obra.
    expect(deriveProgress(todos, fatos({ profiles: 2 }), ordemDosPilares("obras")).nextStep?.key).toBe("cliente");
  });

  it("sem escolha, a ordem é Gestão, Projetos, Obras", () => {
    expect(ordemDosPilares(null)).toEqual(["conta", "gestao", "projetos", "obras"]);
    const d = deriveProgress(todos, fatos({ profiles: 2 }));
    expect(d.nextStep?.key).toBe("cliente");
  });

  it("nextStep cai em opcional só quando não há obrigatório pendente", () => {
    const d = deriveProgress(
      todos,
      fatos({ profiles: 2, clientes: 1, pessoas: 1, contas: 1, propostas: 1, "projetos:sem_exemplo": 1, obras: 1 })
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
        {
          clientes: 1,
          propostas: 1,
          contas: 1,
          cartoes: 1,
          lancamentos: 1,
          "projetos:sem_exemplo": 1,
          fluxos_disciplinas: 1,
        },
        "https://x/a.png"
      )
    );
    expect(d.allDone).toBe(true);
    expect(d.percent).toBe(100);
    expect(d.nextStep).toBeNull();
  });
});

describe("dependências entre passos (SPEC 165)", () => {
  const todos = filterVisibleSteps(ONBOARDING_STEPS, allowAll, true);
  const passo = (d: ReturnType<typeof deriveProgress>, key: string) => d.steps.find((s) => s.key === key)!;

  it("projeto fica bloqueado até ter cliente e equipe", () => {
    const d = deriveProgress(todos, fatos());
    expect(passo(d, "projeto").bloqueadoPor.map((p) => p.key)).toEqual(["cliente", "equipe"]);
    const comCliente = deriveProgress(todos, fatos({ clientes: 1 }));
    expect(passo(comCliente, "projeto").bloqueadoPor.map((p) => p.key)).toEqual(["equipe"]);
    const completo = deriveProgress(todos, fatos({ clientes: 1, pessoas: 1 }));
    expect(passo(completo, "projeto").bloqueadoPor).toEqual([]);
  });

  it("proposta e obra pedem cliente", () => {
    const d = deriveProgress(todos, fatos());
    expect(passo(d, "proposta").bloqueadoPor.map((p) => p.key)).toEqual(["cliente"]);
    expect(passo(d, "obra").bloqueadoPor.map((p) => p.key)).toEqual(["cliente"]);
  });

  it("passo feito nunca aparece como bloqueado, mesmo sem o pré-requisito", () => {
    const d = deriveProgress(todos, fatos({ "projetos:sem_exemplo": 1 }));
    expect(passo(d, "projeto").done).toBe(true);
    expect(passo(d, "projeto").bloqueadoPor).toEqual([]);
  });

  it("pré-requisito que a pessoa não vê não bloqueia (convidado não vê Equipe)", () => {
    const convidado = filterVisibleSteps(ONBOARDING_STEPS, allowAll, false);
    const d = deriveProgress(convidado, fatos({ clientes: 1 }));
    expect(passo(d, "projeto").bloqueadoPor).toEqual([]);
  });

  it("lançamento só sugere conta e projeto: não bloqueia", () => {
    const d = deriveProgress(todos, fatos());
    expect(passo(d, "financeiro").bloqueadoPor).toEqual([]);
    expect(passo(d, "financeiro").sugeridoAntes.map((p) => p.key)).toEqual(["conta_bancaria", "projeto"]);
  });

  it("o próximo passo nunca é um passo bloqueado", () => {
    for (const counts of [{}, { clientes: 1 }, { clientes: 1, pessoas: 1 }] as Record<string, number>[]) {
      const d = deriveProgress(todos, fatos({ profiles: 2, ...counts }));
      expect(d.nextStep?.bloqueadoPor ?? []).toEqual([]);
    }
  });

  it("o grafo é válido: pré-requisitos existem, não há ciclo e a ordem respeita cada dependência", () => {
    const chaves = new Set(ONBOARDING_STEPS.map((s) => s.key));
    for (const s of ONBOARDING_STEPS) {
      for (const dep of [...(s.dependeDe ?? []), ...(s.sugereAntes ?? [])]) {
        expect(chaves.has(dep), `${s.key} depende de ${dep}, que não existe`).toBe(true);
      }
    }
    const ordem = ordemTopologica();
    expect(ordem).toHaveLength(ONBOARDING_STEPS.length);
    for (const s of ONBOARDING_STEPS) {
      for (const dep of [...(s.dependeDe ?? []), ...(s.sugereAntes ?? [])]) {
        expect(ordem.indexOf(dep)).toBeLessThan(ordem.indexOf(s.key));
      }
    }
  });

  it("detecta dependência circular", () => {
    const base = ONBOARDING_STEPS.slice(0, 2).map((s) => ({ ...s }));
    base[0] = { ...base[0], dependeDe: [base[1].key] };
    base[1] = { ...base[1], dependeDe: [base[0].key] };
    expect(() => ordemTopologica(base)).toThrow(/circular/);
  });

  it("pré-requisitos obrigatórios são transitivos", () => {
    expect(prerequisitosObrigatorios("projeto").sort()).toEqual(["cliente", "equipe"]);
    expect(prerequisitosObrigatorios("cliente")).toEqual([]);
  });
});

import { ONBOARDING_STEPS, type OnboardingStep } from "@/lib/onboarding/steps";
import { OBJETIVO_DA_DOR, rotuloDaDor, type Dor, type ProjetosAtivos } from "@/lib/onboarding/dores";
import type { Objetivo } from "@/lib/perfilEscritorio";

/**
 * Plano provisório (SPEC 165, fase 2): da dor principal e das outras, os passos do
 * checklist que resolvem aquela dor, já na ordem em que um depende do outro. A fase 3
 * troca a tabela de pré-requisitos abaixo por um grafo no próprio `steps.ts`.
 */

/** Passos (chaves de `ONBOARDING_STEPS`) que cada dor pede. */
const PASSOS_DA_DOR: Record<Dor, string[]> = {
  lucro_projeto: ["cliente", "equipe", "projeto", "financeiro"],
  prazos: ["cliente", "equipe", "projeto", "fluxo"],
  propostas: ["cliente", "proposta", "projeto"],
  financeiro: ["cliente", "financeiro"],
  equipe: ["equipe", "colega", "projeto"],
  cliente_andamento: ["cliente", "projeto", "colega"],
  aditivos: ["cliente", "proposta", "projeto"],
  obra: ["cliente", "obra", "fornecedor"],
  espalhado: ["cliente", "equipe", "projeto", "colega"],
  outra: ["cliente", "equipe", "projeto"],
};

/** Ordem em que as coisas dependem umas das outras: quem vem antes é pré-requisito. */
const ORDEM_DE_DEPENDENCIA = [
  "cliente",
  "equipe",
  "colega",
  "proposta",
  "projeto",
  "fluxo",
  "financeiro",
  "obra",
  "fornecedor",
];

/** Minutos que cada passo costuma levar, para o "~N min no total" do plano. */
const MINUTOS: Record<string, number> = {
  cliente: 3,
  equipe: 5,
  colega: 2,
  proposta: 8,
  projeto: 8,
  fluxo: 5,
  financeiro: 3,
  obra: 5,
  fornecedor: 3,
};

export interface PassoDoPlano {
  key: string;
  titulo: string;
  descricao: string;
  rota: string;
  minutos: number;
  /** Dor que puxou este passo (a primeira das escolhidas que o pede). */
  motivo: Dor;
  motivoRotulo: string;
}

export interface PlanoOnboarding {
  passos: PassoDoPlano[];
  minutosTotal: number;
  /** Pilar que ordena o checklist: o da dor principal. */
  objetivo: Objetivo;
}

function passoPorChave(key: string): OnboardingStep | undefined {
  return ONBOARDING_STEPS.find((s) => s.key === key);
}

export interface EntradaDoPlano {
  dores: Dor[];
  dorPrincipal: Dor | null;
  projetosAtivos?: ProjetosAtivos;
  /** Faixa de pessoas do escritório (`empresas.porte`). Equipe grande puxa Equipe para antes de tudo. */
  porte?: string | null;
}

export function montarPlano({ dores, dorPrincipal, projetosAtivos, porte }: EntradaDoPlano): PlanoOnboarding {
  // Sem resposta (pulou): plano padrão de começo, o mesmo da dor "outra".
  const ordemDeDores: Dor[] =
    dores.length === 0 ? ["outra"] : [...new Set<Dor>([...(dorPrincipal ? [dorPrincipal] : []), ...dores])];

  const motivoDe = new Map<string, Dor>();
  for (const dor of ordemDeDores) {
    for (const key of PASSOS_DA_DOR[dor]) if (!motivoDe.has(key)) motivoDe.set(key, dor);
  }

  // Equipe grande (16+ pessoas) sempre precisa de Equipe e de colegas convidados.
  if (porte === "16-40" || porte === "40+") {
    if (!motivoDe.has("equipe")) motivoDe.set("equipe", ordemDeDores[0]);
    if (!motivoDe.has("colega")) motivoDe.set("colega", ordemDeDores[0]);
  }
  // Muitos projetos ativos pedem o fluxo de disciplinas padronizado.
  if ((projetosAtivos === "16-30" || projetosAtivos === "30+") && motivoDe.has("projeto") && !motivoDe.has("fluxo")) {
    motivoDe.set("fluxo", ordemDeDores[0]);
  }

  const passos: PassoDoPlano[] = [];
  for (const key of ORDEM_DE_DEPENDENCIA) {
    const motivo = motivoDe.get(key);
    const passo = passoPorChave(key);
    if (!motivo || !passo) continue;
    passos.push({
      key,
      titulo: passo.titulo,
      descricao: passo.descricao,
      rota: passo.rota,
      minutos: MINUTOS[key] ?? 5,
      motivo,
      motivoRotulo: rotuloDaDor(motivo),
    });
  }

  return {
    passos,
    minutosTotal: passos.reduce((soma, p) => soma + p.minutos, 0),
    objetivo: OBJETIVO_DA_DOR[ordemDeDores[0]],
  };
}

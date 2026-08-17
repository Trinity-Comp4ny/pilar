import type { Feature } from "@/lib/permissions";

/**
 * Registro canônico do onboarding guiado. Fonte única dos passos, agrupados por
 * pilar (Gestão / Projetos / Obras). O PROGRESSO de cada passo é derivado de
 * contagem de entidades reais (ver useOnboardingProgress), nunca gravado: se a
 * empresa tem ao menos 1 registro em `count.source`, o passo está concluído.
 *
 * Cada passo declara a `feature` que exige e (quando for o caso) `adminOnly`, e é
 * filtrado pelo mesmo mecanismo que gateia as rotas (usePermissions). A seção
 * Obras só aparece para empresas com a feature `obras` ligada.
 */

export type OnboardingPilar = "gestao" | "projetos" | "obras";

/** Tabelas/views usadas para derivar "passo concluído". Todas têm `empresa_id`. */
export type OnboardingCountSource =
  | "pessoas"
  | "clientes"
  | "lancamentos"
  | "projetos"
  | "fluxos_disciplinas"
  | "obras"
  | "fornecedores";

export interface OnboardingStep {
  key: string;
  pilar: OnboardingPilar;
  titulo: string;
  descricao: string;
  /** Rota do CTA e alvo do tour por página. */
  rota: string;
  feature: Feature;
  /** Só aparece para admin/owner (ex.: Equipe). */
  adminOnly?: boolean;
  /** Não conta para o "obrigatório", mas soma no progresso. */
  opcional?: boolean;
  count: { source: OnboardingCountSource; softDelete: boolean };
  /** Coach mark da página: aponta para o elemento com `[data-tour=selector]`. */
  tour: { selector: string; titulo: string; texto: string };
}

export const PILAR_LABEL: Record<OnboardingPilar, string> = {
  gestao: "Gestão",
  projetos: "Projetos",
  obras: "Obras",
};

export const PILAR_ORDER: OnboardingPilar[] = ["gestao", "projetos", "obras"];

export const ONBOARDING_STEPS: OnboardingStep[] = [
  // ————— Gestão —————
  {
    key: "equipe",
    pilar: "gestao",
    titulo: "Cadastre sua equipe",
    descricao: "As pessoas que executam os projetos do escritório.",
    rota: "/gestao/equipe",
    feature: "pessoas",
    adminOnly: true,
    count: { source: "pessoas", softDelete: true },
    tour: {
      selector: "onb-nova-pessoa",
      titulo: "Comece pela equipe",
      texto: "Clique aqui para adicionar a primeira pessoa. Ela poderá receber disciplinas e responsabilidades nos projetos.",
    },
  },
  {
    key: "cliente",
    pilar: "gestao",
    titulo: "Cadastre um cliente",
    descricao: "Quem contrata os serviços. É pré-requisito para abrir um projeto.",
    rota: "/gestao/clientes",
    feature: "clientes",
    count: { source: "clientes", softDelete: true },
    tour: {
      selector: "onb-novo-cliente",
      titulo: "Cadastre um cliente",
      texto: "Sem cliente não dá para abrir projeto. Clique aqui para criar o primeiro.",
    },
  },
  {
    key: "financeiro",
    pilar: "gestao",
    titulo: "Faça um lançamento",
    descricao: "Registre a primeira receita ou despesa para acompanhar o caixa.",
    rota: "/gestao/financeiro",
    feature: "financeiro",
    opcional: true,
    count: { source: "lancamentos", softDelete: true },
    tour: {
      selector: "onb-lancamentos",
      titulo: "Controle o caixa",
      texto: "Na aba Lançamentos você registra receitas e despesas e vincula ao projeto.",
    },
  },

  // ————— Projetos —————
  {
    key: "projeto",
    pilar: "projetos",
    titulo: "Abra seu primeiro projeto",
    descricao: "Escopo, prazo e equipe por disciplina. O coração do Pilar.",
    rota: "/projetos",
    feature: "projetos",
    count: { source: "projetos", softDelete: true },
    tour: {
      selector: "onb-novo-projeto",
      titulo: "Crie um projeto",
      texto: "Clique aqui para abrir o assistente: cliente, escopo e a equipe por disciplina.",
    },
  },
  {
    key: "fluxo",
    pilar: "projetos",
    titulo: "Monte um fluxo de disciplinas",
    descricao: "A sequência de disciplinas que seus projetos costumam seguir.",
    rota: "/projetos",
    feature: "projetos",
    opcional: true,
    count: { source: "fluxos_disciplinas", softDelete: true },
    tour: {
      selector: "onb-fluxos",
      titulo: "Padronize seu fluxo",
      texto: "Defina uma vez a ordem das disciplinas e reutilize em cada novo projeto.",
    },
  },

  // ————— Obras (só empresas com a feature `obras`) —————
  {
    key: "obra",
    pilar: "obras",
    titulo: "Cadastre uma obra",
    descricao: "A execução em campo, com diário, cronograma e conta da obra.",
    rota: "/obras",
    feature: "obras",
    count: { source: "obras", softDelete: true },
    tour: {
      selector: "onb-nova-obra",
      titulo: "Registre uma obra",
      texto: "Clique aqui para criar a obra. Depois você acompanha diário, cronograma e custos.",
    },
  },
  {
    key: "fornecedor",
    pilar: "obras",
    titulo: "Cadastre um fornecedor",
    descricao: "Quem fornece material e serviço para as obras.",
    rota: "/obras/fornecedores",
    feature: "obras",
    opcional: true,
    count: { source: "fornecedores", softDelete: true },
    tour: {
      selector: "onb-novo-fornecedor",
      titulo: "Adicione fornecedores",
      texto: "Cadastre fornecedores para usar nas cotações e compras da obra.",
    },
  },
];

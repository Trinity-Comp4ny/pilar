import type { Feature } from "@/lib/permissions";
import type { Objetivo } from "@/lib/perfilEscritorio";

/**
 * Registro canônico do onboarding guiado (SPEC 034, refeito na SPEC 149). Fonte
 * única dos passos, agrupados em "Sua conta" e nos três pilares (Gestão,
 * Projetos, Obras), que pesam igual: a ordem dos pilares segue o que o dono
 * escolheu em "Por onde começar". O PROGRESSO de cada passo é derivado de dado
 * real (ver useOnboardingProgress), nunca gravado.
 *
 * Cada passo declara a `feature` que exige (quando exige) e `adminOnly` quando
 * só faz sentido para quem administra; o filtro é o mesmo que gateia as rotas.
 * Admin e convidado veem o mesmo checklist, menos os passos de admin.
 */

export type OnboardingPilar = "conta" | "gestao" | "projetos" | "obras";

/** Tabelas usadas para derivar "passo concluído". Todas têm `empresa_id`. */
type OnboardingCountSource =
  | "pessoas"
  | "clientes"
  | "propostas"
  | "lancamentos"
  | "projetos"
  | "fluxos_disciplinas"
  | "obras"
  | "fornecedores"
  | "profiles";

/** Como o passo é considerado feito. */
export type OnboardingCheck =
  /** Já vem feito: progresso concedido, a pessoa nunca começa do zero. */
  | { tipo: "sempre" }
  /** Campo preenchido no próprio perfil de quem vê. */
  | { tipo: "perfil"; campo: "avatar_url" }
  /**
   * Contagem de registros da empresa. `ativos` diz que coluna marca registro
   * removido; `minimo` é quantos precisam existir (padrão 1); `semExemplo` não
   * conta o dado de demonstração (`exemplo = true`).
   */
  | {
      tipo: "tabela";
      source: OnboardingCountSource;
      ativos: "deleted_at" | "desativado_em" | null;
      minimo?: number;
      semExemplo?: boolean;
    };

export interface OnboardingStep {
  key: string;
  pilar: OnboardingPilar;
  titulo: string;
  descricao: string;
  /** Rota do CTA e alvo do tour por página. */
  rota: string;
  /** Feature exigida; sem ela, o passo vale para todo mundo. */
  feature?: Feature;
  /** Só aparece para admin/owner (ex.: convidar colega). */
  adminOnly?: boolean;
  /** Não conta para o "obrigatório", mas soma no progresso. */
  opcional?: boolean;
  check: OnboardingCheck;
  /** Coach mark da página: aponta para o elemento com `[data-tour=selector]`. */
  tour?: { selector: string; titulo: string; texto: string };
}

export const PILAR_LABEL: Record<OnboardingPilar, string> = {
  conta: "Sua conta",
  gestao: "Gestão",
  projetos: "Projetos",
  obras: "Obras",
};

export const PILAR_ORDER: OnboardingPilar[] = ["conta", "gestao", "projetos", "obras"];

/** "Sua conta" sempre primeiro; depois o pilar escolhido em "Por onde começar", e os outros dois. */
export function ordemDosPilares(objetivo: Objetivo | null | undefined): OnboardingPilar[] {
  if (!objetivo) return PILAR_ORDER;
  return ["conta", objetivo, ...PILAR_ORDER.filter((p) => p !== "conta" && p !== objetivo)];
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  // ————— Sua conta —————
  {
    key: "conta",
    pilar: "conta",
    titulo: "Entre na Pilar",
    descricao: "Conta criada e escritório configurado.",
    rota: "/inicio",
    check: { tipo: "sempre" },
  },
  {
    key: "colega",
    pilar: "conta",
    titulo: "Convide um colega",
    descricao: "A Pilar rende quando o time inteiro registra no mesmo lugar.",
    rota: "/admin",
    adminOnly: true,
    check: { tipo: "tabela", source: "profiles", ativos: "desativado_em", minimo: 2 },
  },
  {
    key: "foto",
    pilar: "conta",
    titulo: "Coloque sua foto",
    descricao: "Ajuda o time a saber quem fez o quê em cada projeto e obra.",
    rota: "/profile",
    opcional: true,
    check: { tipo: "perfil", campo: "avatar_url" },
  },

  // ————— Gestão —————
  {
    key: "cliente",
    pilar: "gestao",
    titulo: "Cadastre um cliente",
    descricao: "Quem contrata o escritório. Proposta, projeto e obra partem dele.",
    rota: "/gestao/clientes",
    feature: "clientes",
    check: { tipo: "tabela", source: "clientes", ativos: "deleted_at" },
    tour: {
      selector: "onb-novo-cliente",
      titulo: "Cadastre um cliente",
      texto: "Sem cliente não dá para abrir proposta nem projeto. Clique aqui para criar o primeiro.",
    },
  },
  {
    key: "proposta",
    pilar: "gestao",
    titulo: "Crie uma proposta",
    descricao: "Escopo, valor e condições. Aprovada, vira projeto sem redigitar.",
    rota: "/gestao/propostas",
    feature: "propostas",
    check: { tipo: "tabela", source: "propostas", ativos: "deleted_at" },
    tour: {
      selector: "onb-nova-proposta",
      titulo: "Monte a primeira proposta",
      texto: "Clique aqui para montar a proposta. Quando o cliente aprovar, ela abre o projeto.",
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
    check: { tipo: "tabela", source: "lancamentos", ativos: "deleted_at" },
    tour: {
      selector: "onb-lancamentos",
      titulo: "Controle o caixa",
      texto: "Na aba Lançamentos você registra receitas e despesas e vincula ao projeto.",
    },
  },
  {
    key: "equipe",
    pilar: "gestao",
    titulo: "Cadastre sua equipe",
    descricao: "Quem executa os projetos, com custo e disciplina de cada um.",
    rota: "/gestao/equipe",
    feature: "pessoas",
    adminOnly: true,
    opcional: true,
    check: { tipo: "tabela", source: "pessoas", ativos: "deleted_at" },
    tour: {
      selector: "onb-nova-pessoa",
      titulo: "Cadastre a equipe",
      texto:
        "Clique aqui para adicionar a primeira pessoa. Ela poderá receber disciplinas e responsabilidades nos projetos.",
    },
  },

  // ————— Projetos —————
  {
    key: "projeto",
    pilar: "projetos",
    titulo: "Abra seu primeiro projeto",
    descricao: "Escopo, fases, disciplinas e prazo de cada entrega.",
    rota: "/projetos",
    feature: "projetos",
    check: { tipo: "tabela", source: "projetos", ativos: "deleted_at", semExemplo: true },
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
    check: { tipo: "tabela", source: "fluxos_disciplinas", ativos: "deleted_at" },
    tour: {
      selector: "onb-fluxos",
      titulo: "Padronize seu fluxo",
      texto: "Defina uma vez a ordem das disciplinas e reutilize em cada novo projeto.",
    },
  },

  // ————— Obras —————
  {
    key: "obra",
    pilar: "obras",
    titulo: "Cadastre uma obra",
    descricao: "A execução em campo, com diário, cronograma e conta da obra.",
    rota: "/obras",
    feature: "obras",
    check: { tipo: "tabela", source: "obras", ativos: "deleted_at" },
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
    check: { tipo: "tabela", source: "fornecedores", ativos: "deleted_at" },
    tour: {
      selector: "onb-novo-fornecedor",
      titulo: "Adicione fornecedores",
      texto: "Cadastre fornecedores para usar nas cotações e compras da obra.",
    },
  },
];

/** Chave da contagem de um passo de tabela (a mesma tabela pode ter filtros diferentes). */
export function chaveDaContagem(check: Extract<OnboardingCheck, { tipo: "tabela" }>): string {
  return check.semExemplo ? `${check.source}:sem_exemplo` : check.source;
}

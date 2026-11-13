import type { Objetivo } from "@/lib/perfilEscritorio";

/**
 * Questionário do onboarding inteligente (SPEC 165). Fonte única das dores, das
 * perguntas de aprofundamento e das faixas. Os valores são gravados em
 * `onboarding_respostas` (a migration valida a lista de dores: mudou aqui, mude lá).
 */

export const VERSAO_QUESTIONARIO = 1;
export const MAX_DORES = 3;

export const DORES = [
  { value: "lucro_projeto", label: "Não sei o lucro de cada projeto" },
  { value: "prazos", label: "Estouro de prazo e de cronograma" },
  { value: "propostas", label: "Proposta lenta ou sem padrão" },
  { value: "financeiro", label: "Financeiro em planilha: receber, pagar, caixa" },
  { value: "equipe", label: "Não sei quem está fazendo o quê" },
  { value: "cliente_andamento", label: "O cliente pergunta o andamento e eu não tenho resposta rápida" },
  { value: "aditivos", label: "Escopo cresce e eu não cobro aditivo" },
  { value: "obra", label: "Controle de obra: diário, medição, fornecedor" },
  { value: "espalhado", label: "Tudo espalhado em WhatsApp, e-mail e planilha" },
] as const;

export type Dor = (typeof DORES)[number]["value"] | "outra";

export function ehDor(v: unknown): v is Dor {
  return v === "outra" || DORES.some((d) => d.value === v);
}

export function rotuloDaDor(dor: Dor): string {
  if (dor === "outra") return "Outra dor";
  return DORES.find((d) => d.value === dor)?.label ?? dor;
}

/** Pilar do checklist que cada dor puxa para o começo (ordena o checklist da SPEC 149). */
export const OBJETIVO_DA_DOR: Record<Dor, Objetivo> = {
  lucro_projeto: "gestao",
  prazos: "projetos",
  propostas: "gestao",
  financeiro: "gestao",
  equipe: "gestao",
  cliente_andamento: "projetos",
  aditivos: "gestao",
  obra: "obras",
  espalhado: "gestao",
  outra: "gestao",
};

export interface Aprofundamento {
  pergunta: string;
  opcoes: { value: string; label: string }[];
}

/** Uma pergunta por dor, sobre como a pessoa resolve hoje. Ajuda a copy do plano e vira dado de mercado. */
export const APROFUNDAMENTO: Record<Dor, Aprofundamento> = {
  lucro_projeto: {
    pergunta: "Como você descobre se um projeto deu lucro?",
    opcoes: [
      { value: "so_no_fim", label: "Só no fim, na conta" },
      { value: "planilha", label: "Numa planilha que eu atualizo" },
      { value: "nao_sei", label: "Na verdade, não sei" },
    ],
  },
  prazos: {
    pergunta: "Como você acompanha o prazo das entregas hoje?",
    opcoes: [
      { value: "planilha", label: "Planilha ou cronograma solto" },
      { value: "whatsapp", label: "Cobrando no WhatsApp" },
      { value: "cabeca", label: "Na minha cabeça" },
    ],
  },
  propostas: {
    pergunta: "Como é montada uma proposta hoje?",
    opcoes: [
      { value: "documento", label: "Reaproveito um documento antigo" },
      { value: "do_zero", label: "Do zero, a cada cliente" },
      { value: "template", label: "Tenho um modelo, mas é manual" },
    ],
  },
  financeiro: {
    pergunta: "Quem cuida do financeiro do escritório?",
    opcoes: [
      { value: "socio", label: "Eu mesmo, o sócio" },
      { value: "administrativo", label: "Uma pessoa do administrativo" },
      { value: "contador", label: "O contador, de fora" },
    ],
  },
  equipe: {
    pergunta: "Como você distribui o trabalho da equipe?",
    opcoes: [
      { value: "conversa", label: "Na conversa, no dia a dia" },
      { value: "planilha", label: "Numa planilha de alocação" },
      { value: "sistema", label: "Num sistema, mas não funciona bem" },
    ],
  },
  cliente_andamento: {
    pergunta: "Como o cliente fica sabendo do andamento?",
    opcoes: [
      { value: "pergunta", label: "Ele pergunta e eu respondo" },
      { value: "relatorio", label: "Mando um relatório de vez em quando" },
      { value: "nao_acompanha", label: "Ele não acompanha" },
    ],
  },
  aditivos: {
    pergunta: "O que acontece quando o cliente pede algo fora do escopo?",
    opcoes: [
      { value: "faz_sem_cobrar", label: "Acabo fazendo sem cobrar" },
      { value: "negocia", label: "Negocio na hora, sem registro" },
      { value: "aditivo", label: "Faço aditivo, mas dá trabalho" },
    ],
  },
  obra: {
    pergunta: "Como você registra o que acontece na obra?",
    opcoes: [
      { value: "papel", label: "Papel e caderno" },
      { value: "whatsapp", label: "Fotos e mensagens no WhatsApp" },
      { value: "planilha", label: "Planilha de medição" },
    ],
  },
  espalhado: {
    pergunta: "Onde está a informação dos seus projetos hoje?",
    opcoes: [
      { value: "pastas", label: "Em pastas e arquivos" },
      { value: "whatsapp_email", label: "Em conversas de WhatsApp e e-mail" },
      { value: "pessoas", label: "Cada pessoa guarda o seu" },
    ],
  },
  outra: {
    pergunta: "Como você lida com isso hoje?",
    opcoes: [
      { value: "planilha", label: "Com planilhas" },
      { value: "conversa", label: "Na conversa, sem registro" },
      { value: "nao_resolvo", label: "Ainda não resolvo" },
    ],
  },
};

export const PROJETOS_ATIVOS = [
  { value: "1-5", label: "1 a 5" },
  { value: "6-15", label: "6 a 15" },
  { value: "16-30", label: "16 a 30" },
  { value: "30+", label: "Mais de 30" },
] as const;
export type ProjetosAtivos = (typeof PROJETOS_ATIVOS)[number]["value"];

export const FERRAMENTAS = [
  { value: "planilhas", label: "Planilhas (Excel, Google)" },
  { value: "whatsapp_email", label: "WhatsApp e e-mail" },
  { value: "sistema_gestao", label: "Outro sistema de gestão" },
  { value: "papel", label: "Papel e caderno" },
  { value: "nada", label: "Nada organizado ainda" },
] as const;
export type Ferramenta = (typeof FERRAMENTAS)[number]["value"];

/** Respostas como a tela e o banco as guardam. */
export interface RespostasOnboarding {
  dores: Dor[];
  dorPrincipal: Dor | null;
  textoLivre: string;
  contexto: {
    aprofundamento?: { dor: Dor; resposta: string };
    projetosAtivos?: ProjetosAtivos;
    ferramentas?: Ferramenta[];
  };
  etapaAtual: number;
  concluidoEm: string | null;
}

export const RESPOSTAS_VAZIAS: RespostasOnboarding = {
  dores: [],
  dorPrincipal: null,
  textoLivre: "",
  contexto: {},
  etapaAtual: 1,
  concluidoEm: null,
};

/**
 * A dor principal é a primeira escolhida; sai da lista, a seguinte assume. Sem dor
 * escolhida não há principal (a pessoa pulou a pergunta).
 */
export function dorPrincipalDe(dores: Dor[], atual: Dor | null): Dor | null {
  if (atual && dores.includes(atual)) return atual;
  return dores[0] ?? null;
}

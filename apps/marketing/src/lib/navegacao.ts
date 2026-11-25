/**
 * Dados mínimos de módulos e comparativos para o header e o rodapé, que entram
 * no bundle inicial de TODA página.
 *
 * `modules.ts` e `comparativos.ts` carregam o texto inteiro das páginas (~40 KB
 * de fonte) e só as páginas preguiçosas precisam deles. Importá-los daqui para
 * montar um menu puxava tudo para o primeiro carregamento (Lighthouse:
 * "Reduce unused JavaScript"). O teste de navegacao.test.ts garante que estas
 * listas não divergem das fontes.
 */
import type { ComparativoSlug } from "./comparativos";
import type { ModuloSlug } from "./modules";

export interface ModuloNav {
  slug: ModuloSlug;
  nome: string;
  resumo: string;
  /** Classe do ponto de cor no menu (a mesma de Modulo.cor.strong). */
  corStrong: string;
}

export interface ComparativoNav {
  slug: ComparativoSlug;
  adversario: string;
}

export const MODULOS_NAV: ModuloNav[] = [
  { slug: "gestao", nome: "Gestão", resumo: "Do lead ao dinheiro na conta.", corStrong: "bg-modulo-gestao-strong" },
  {
    slug: "projetos",
    nome: "Projetos",
    resumo: "Disciplina, prazo e responsável.",
    corStrong: "bg-modulo-projetos-strong",
  },
  { slug: "obra", nome: "Obra", resumo: "O canteiro alimenta o escritório.", corStrong: "bg-modulo-obra-strong" },
  {
    slug: "portal",
    nome: "Portal do cliente",
    resumo: "Seu cliente acompanha sozinho.",
    corStrong: "bg-modulo-gestao-strong",
  },
  { slug: "campo", nome: "Pilar Campo", resumo: "O canteiro registra, sem sinal.", corStrong: "bg-modulo-obra-strong" },
];

export const COMPARATIVOS_NAV: ComparativoNav[] = [
  { slug: "planilha", adversario: "Planilha" },
  { slug: "trello", adversario: "Trello" },
  { slug: "whatsapp", adversario: "WhatsApp" },
  { slug: "notion", adversario: "Notion" },
  { slug: "erp-construtora", adversario: "ERP de construtora" },
  { slug: "omie-conta-azul", adversario: "Omie e Conta Azul" },
  { slug: "software-de-arquitetura", adversario: "Software só de arquitetura" },
  { slug: "sistema-simples", adversario: "Sistema simples e barato" },
  { slug: "plataforma-por-usuario", adversario: "Plataforma que cobra por usuário" },
];

/**
 * Colunas do mega-menu "Funcionalidades": cada área do catálogo com os recursos
 * que têm página própria. Rótulos curtos de propósito (o título da página,
 * "Propostas de engenharia por disciplina", não cabe numa coluna). O teste
 * confere que todo `to` existe no catálogo e que está na área certa.
 */
export interface ColunaMenu {
  id: string;
  titulo: string;
  href: string;
  resumo: string;
  /** Classe do ponto de cor (mesmo critério de MODULOS_NAV). */
  corStrong: string;
  links: { rotulo: string; to: string; selo?: "IA" | "Offline" }[];
}

export const COLUNAS_MENU: ColunaMenu[] = [
  {
    id: "gestao",
    titulo: "Gestão",
    href: "/gestao",
    resumo: "Do primeiro contato ao recebimento.",
    corStrong: "bg-modulo-gestao-strong",
    links: [
      { rotulo: "Propostas por disciplina", to: "/funcionalidades/propostas" },
      { rotulo: "CRM e funil de leads", to: "/funcionalidades/crm" },
      { rotulo: "Financeiro", to: "/funcionalidades/financeiro" },
      { rotulo: "Importação de extratos", to: "/funcionalidades/importacao-financeira" },
      { rotulo: "Carteira, contas e cartões", to: "/funcionalidades/carteira-e-cartoes" },
      { rotulo: "Equipe e horas", to: "/funcionalidades/equipe-e-horas" },
    ],
  },
  {
    id: "projetos",
    titulo: "Projetos",
    href: "/projetos",
    resumo: "A carteira inteira, por disciplina.",
    corStrong: "bg-modulo-projetos-strong",
    links: [
      { rotulo: "Projetos por disciplina", to: "/funcionalidades/disciplinas" },
      { rotulo: "Cronograma da carteira", to: "/funcionalidades/cronograma" },
      { rotulo: "Escopo e aditivos", to: "/funcionalidades/escopo-e-aditivos" },
      { rotulo: "Rentabilidade", to: "/funcionalidades/rentabilidade" },
    ],
  },
  {
    id: "obra",
    titulo: "Obra",
    href: "/obra",
    resumo: "O canteiro alimenta o escritório.",
    corStrong: "bg-modulo-obra-strong",
    links: [
      { rotulo: "Diário de obra", to: "/funcionalidades/diario-de-obra" },
      { rotulo: "Cotação de materiais", to: "/funcionalidades/cotacoes" },
      { rotulo: "Prestação de contas", to: "/funcionalidades/prestacao-de-contas" },
      { rotulo: "Cronograma e avanço físico", to: "/funcionalidades/cronograma-de-obra" },
      { rotulo: "Estoque de materiais", to: "/funcionalidades/estoque-de-obra" },
      { rotulo: "Estimativas de custo", to: "/funcionalidades/estimativas-de-obra" },
    ],
  },
  {
    id: "campo",
    titulo: "Pilar Campo",
    href: "/campo",
    resumo: "O canteiro registra, sem sinal.",
    corStrong: "bg-modulo-obra-strong",
    links: [
      { rotulo: "Registro do dia no celular", to: "/funcionalidades/campo-registro-do-dia" },
      { rotulo: "Funciona sem sinal", to: "/funcionalidades/campo-offline", selo: "Offline" },
      { rotulo: "Acesso da equipe por obra", to: "/funcionalidades/campo-acesso-da-equipe" },
    ],
  },
  {
    id: "portal",
    titulo: "Portal do cliente",
    href: "/portal",
    resumo: "Seu cliente acompanha sozinho.",
    corStrong: "bg-modulo-gestao-strong",
    links: [
      { rotulo: "Projetos no portal", to: "/funcionalidades/portal-de-projetos" },
      { rotulo: "Obras no portal", to: "/funcionalidades/portal-de-obras" },
      { rotulo: "Parcelas e prestação de contas", to: "/funcionalidades/portal-financeiro" },
    ],
  },
  {
    id: "agentes",
    titulo: "Agentes de IA",
    href: "/funcionalidades/agentes",
    resumo: "A IA prepara, você confere e aprova.",
    corStrong: "bg-brand",
    links: [
      { rotulo: "Lançamentos em linguagem natural", to: "/funcionalidades/agentes", selo: "IA" },
      { rotulo: "Extratos e faturas", to: "/funcionalidades/agente-extratos", selo: "IA" },
      { rotulo: "Orçamentos de fornecedor", to: "/funcionalidades/agente-orcamentos", selo: "IA" },
      { rotulo: "Estimativa de obra", to: "/funcionalidades/agente-estimativas", selo: "IA" },
    ],
  },
];

export interface LinkNav {
  rotulo: string;
  resumo: string;
  to: string;
}

export interface GrupoPublico {
  grupo: string;
  links: LinkNav[];
}

/**
 * "Para quem": três tipos de negócio, não profissões (DECISOES.md, 2026-11-24). O
 * escritório de projeto mantém as duas páginas que já ranqueiam (engenharia e
 * arquitetura); obra e sob medida são as frentes novas.
 */
export const PUBLICOS_NAV: GrupoPublico[] = [
  {
    grupo: "Escritórios de projeto",
    links: [
      { rotulo: "Engenharia", resumo: "Civil, estrutural e MEP, com prazo por disciplina.", to: "/engenharia" },
      { rotulo: "Arquitetura", resumo: "Do briefing à obra, com o cliente por dentro.", to: "/arquitetura" },
    ],
  },
  {
    grupo: "Obra",
    links: [
      {
        rotulo: "Gestão e execução de obra",
        resumo: "Diário, compras, aportes e prestação de contas.",
        to: "/gestao-de-obra",
      },
    ],
  },
  {
    grupo: "Sob medida",
    links: [
      {
        rotulo: "Marcenaria, planejados e marmoraria",
        resumo: "Do orçamento à instalação, com parcela e prazo.",
        to: "/sob-medida",
      },
    ],
  },
];

/** Todos os links de público, sem o agrupamento (rodapé e testes). */
export const PUBLICOS_LINKS: LinkNav[] = PUBLICOS_NAV.flatMap((g) => g.links);

/**
 * Conteúdo de apoio. Saiu do header (que fica com Funcionalidades, Para quem e
 * Planos) e mora no rodapé.
 */
export const RECURSOS_NAV: LinkNav[] = [
  { rotulo: "Blog", resumo: "Gestão de escritório e de obra, sem enrolação.", to: "/blog" },
  { rotulo: "Ferramentas", resumo: "Calculadora de honorários e modelo de proposta.", to: "/ferramentas" },
  { rotulo: "Perguntas frequentes", resumo: "Implantação, dados, segurança e preço.", to: "/faq" },
];

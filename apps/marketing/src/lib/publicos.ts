import type { ModuloSlug } from "./modules";

/**
 * Páginas por público (`/engenharia`, `/arquitetura`): a porta de entrada de quem
 * busca "software de gestão para escritório de engenharia" ou "sistema para escritório
 * de arquitetura". O produto é o mesmo; muda o vocabulário e a dor que abre a página.
 * Só cita o que existe em `modules.ts` (ICP desde 2026-09-01, ver DECISOES.md).
 */

export type PublicoSlug = "engenharia" | "arquitetura";

export interface Publico {
  slug: PublicoSlug;
  /** Title da aba e do Google, sem o " | Pilar". */
  tituloSeo: string;
  descricao: string;
  /** H1: a palavra-chave, com o fim em itálico apagado. */
  headline: string;
  headlineFim: string;
  lede: string;
  dores: { titulo: string; texto: string }[];
  /** Como cada módulo resolve, na língua deste público. */
  frentes: { slug: ModuloSlug; titulo: string; texto: string }[];
  paraQuem: string[];
  naoE: string[];
  faq: { pergunta: string; resposta: string }[];
  /** Artigos do blog mais ligados a este público. */
  artigos: string[];
}

export const PUBLICOS: Publico[] = [
  {
    slug: "engenharia",
    tituloSeo: "Software de gestão para escritório de engenharia",
    descricao:
      "Software de gestão para escritório de engenharia: proposta por disciplina, prazo de projeto, financeiro e obra no mesmo sistema, com agentes de IA.",
    headline: "Software de gestão para escritório de engenharia,",
    headlineFim: "do contrato à execução.",
    lede: "Civil, estrutural, elétrica, hidráulica, HVAC: o escritório vende projeto por disciplina e precisa enxergar prazo, responsável e dinheiro de cada uma. A Pilar junta proposta, projeto, obra e financeiro, e os agentes de IA preparam o trabalho para a equipe aprovar.",
    dores: [
      {
        titulo: "Cada disciplina numa planilha",
        texto:
          "O estrutural atrasa e ninguém vê até o cliente ligar. O prazo mora na cabeça de quem coordena, não num lugar que a equipe consulta.",
      },
      {
        titulo: "Proposta montada do zero",
        texto:
          "Cada proposta copia a anterior, troca valor na mão e esquece uma disciplina. Quando é aprovada, alguém redigita tudo para abrir o projeto.",
      },
      {
        titulo: "O lucro só aparece no fim",
        texto:
          "Parcela do contrato numa planilha, despesa no extrato do banco, folha em outro arquivo. Saber se o projeto deu dinheiro vira trabalho de fim de mês.",
      },
    ],
    frentes: [
      {
        slug: "gestao",
        titulo: "Do lead à proposta assinada",
        texto:
          "Funil de leads, cliente preenchido pelo CNPJ e proposta por disciplina no template do escritório, em DOCX. Aprovou, virou projeto e receita.",
      },
      {
        slug: "projetos",
        titulo: "Prazo por disciplina, com responsável",
        texto:
          "Quadro com as colunas do escritório, Gantt da carteira inteira e mais de um responsável por disciplina. Atraso pede justificativa.",
      },
      {
        slug: "obra",
        titulo: "Obra por administração sem planilha paralela",
        texto:
          "Diário que chega do celular do canteiro, cotação de material comparada e conta da obra com aporte, despesa com comprovante e a sua taxa.",
      },
      {
        slug: "portal",
        titulo: "O cliente acompanha sozinho",
        texto: "Um link só de leitura com disciplinas, entregas e parcelas. A pergunta de sexta à tarde some.",
      },
    ],
    paraQuem: [
      "Escritório de projeto técnico que vende por proposta",
      "Engenharia multidisciplinar: civil, estrutural, elétrica, hidráulica, HVAC",
      "Quem administra obra por taxa e presta contas ao cliente",
      "Usuários ilimitados: o preço é por escritório, não por pessoa",
    ],
    naoE: [
      "Não é ERP de construtora nem de incorporadora",
      "Não substitui software de cálculo, CAD ou BIM",
      "Não faz nada sem a aprovação de alguém da equipe",
    ],
    faq: [
      {
        pergunta: "A Pilar serve para escritório de engenharia pequeno?",
        resposta:
          "Serve. O preço é por escritório, não por usuário, e o plano Essencial cobre até 10 projetos ativos. Quem cresce muda de plano pela quantidade de projetos, obras e leads ativos.",
      },
      {
        pergunta: "Substitui o software de cálculo ou o CAD?",
        resposta:
          "Não. A Pilar cuida da gestão do escritório: proposta, prazo, financeiro e obra. O projeto técnico continua nas ferramentas que a equipe já usa.",
      },
      {
        pergunta: "O que os agentes de IA fazem?",
        resposta:
          "Consultam os dados do escritório e preparam ações, como proposta, lançamento financeiro a partir de extrato e leitura de orçamento de fornecedor. Nada é executado sem revisão e aprovação de uma pessoa da equipe.",
      },
      {
        pergunta: "Quanto tempo leva para começar?",
        resposta:
          "A entrada é guiada: na demonstração o time mostra o sistema com o fluxo do seu escritório, e os planos ficam na página de preços para quem já decidiu.",
      },
    ],
    artigos: [
      "software-gestao-escritorio-engenharia",
      "proposta-projeto-engenharia",
      "controle-prazo-projetos-disciplinas",
    ],
  },
  {
    slug: "arquitetura",
    tituloSeo: "Sistema de gestão para escritório de arquitetura",
    descricao:
      "Sistema de gestão para escritório de arquitetura: proposta, etapas do projeto, prazo, financeiro, obra e portal do cliente num lugar só, com agentes de IA.",
    headline: "Sistema de gestão para escritório de arquitetura,",
    headlineFim: "do estudo à obra entregue.",
    lede: "Estudo preliminar, anteprojeto, executivo, complementares e acompanhamento de obra: cada etapa com prazo, responsável e parcela. A Pilar organiza o escritório inteiro e mostra ao cliente onde o projeto está, sem você montar relatório.",
    dores: [
      {
        titulo: "O cliente pergunta toda semana",
        texto:
          "Onde está o projeto, quando sai o executivo, quanto falta pagar. A resposta exige abrir três arquivos e uma conversa de WhatsApp.",
      },
      {
        titulo: "Complementares fora do radar",
        texto:
          "Estrutural, elétrica e hidráulica vêm de parceiros, e o prazo deles some até o dia em que trava a compatibilização.",
      },
      {
        titulo: "Obra que come o lucro do projeto",
        texto:
          "Acompanhamento e administração de obra sem conta separada: compra, comprovante e taxa se misturam e o mês fecha no chute.",
      },
    ],
    frentes: [
      {
        slug: "gestao",
        titulo: "Proposta no template do escritório",
        texto:
          "Proposta por etapa e disciplina, em DOCX com a cara do escritório, enviada sem sair do sistema. Aprovada, vira projeto com parcelas no financeiro.",
      },
      {
        slug: "projetos",
        titulo: "Etapas com prazo e responsável",
        texto:
          "Fluxo padrão do escritório, quadro com as suas colunas e Gantt de todos os projetos. Os complementares entram como disciplinas, com responsável.",
      },
      {
        slug: "portal",
        titulo: "Portal do cliente só de leitura",
        texto:
          "O cliente abre um link e vê etapa, entrega e parcela. Se contratou obra, vê aporte, despesa com comprovante e a sua taxa.",
      },
      {
        slug: "obra",
        titulo: "Diário e conta da obra",
        texto:
          "O canteiro registra o dia pelo celular, mesmo sem sinal, e a prestação de contas sai da conta da obra, não de uma planilha paralela.",
      },
    ],
    paraQuem: [
      "Escritório de arquitetura que vende projeto por proposta",
      "Quem coordena complementares de parceiros",
      "Quem acompanha ou administra obra do cliente",
      "Usuários ilimitados: o preço é por escritório, não por pessoa",
    ],
    naoE: [
      "Não é ferramenta de desenho, render ou BIM",
      "Não é ERP de construtora nem de incorporadora",
      "Não faz nada sem a aprovação de alguém da equipe",
    ],
    faq: [
      {
        pergunta: "A Pilar serve para escritório de arquitetura ou só engenharia?",
        resposta:
          "Serve para os dois. O fluxo de etapa e disciplina que a Pilar organiza é o mesmo de um escritório de arquitetura que coordena complementares e acompanha obra.",
      },
      {
        pergunta: "Meu cliente precisa criar conta para acompanhar o projeto?",
        resposta: "Não. O portal do cliente é um link só de leitura, sem conta, sem aplicativo e sem senha.",
      },
      {
        pergunta: "Consigo usar as etapas do meu escritório?",
        resposta:
          "Sim. O quadro usa as colunas do escritório e o fluxo padrão é configurado uma vez para todos os projetos.",
      },
      {
        pergunta: "Quanto custa?",
        resposta:
          "O preço é por escritório, sem cobrança por usuário. Os planos e o que muda entre eles estão na página de planos.",
      },
    ],
    artigos: [
      "sistema-gestao-escritorio-arquitetura",
      "como-precificar-projeto-arquitetura-engenharia",
      "aditivo-de-projeto",
    ],
  },
];

export const PUBLICOS_POR_SLUG = Object.fromEntries(PUBLICOS.map((p) => [p.slug, p])) as Record<PublicoSlug, Publico>;

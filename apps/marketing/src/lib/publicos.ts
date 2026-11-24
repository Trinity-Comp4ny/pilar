import type { ModuloSlug } from "./modules";

/**
 * Páginas por público (`/engenharia`, `/arquitetura`, `/gestao-de-obra`, `/sob-medida`):
 * três tipos de negócio desde 2026-11-24 (escritório de projeto, obra, sob medida). A porta de entrada de quem
 * busca "software de gestão para escritório de engenharia" ou "sistema para escritório
 * de arquitetura". O produto é o mesmo; muda o vocabulário e a dor que abre a página.
 * Só cita o que existe em `modules.ts` (ICP desde 2026-09-01, ver DECISOES.md).
 */

export type PublicoSlug = "engenharia" | "arquitetura" | "gestao-de-obra" | "sob-medida";

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
        texto: "Uma área do cliente com disciplinas, entregas e parcelas. A pergunta de sexta à tarde some.",
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
        titulo: "Portal do cliente com acesso próprio",
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
        resposta: "Não. O portal do cliente abre no navegador com o acesso disponibilizado pelo escritório.",
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
  {
    slug: "gestao-de-obra",
    tituloSeo: "Software de gestão de obra",
    descricao:
      "Software de gestão de obra: diário pelo celular, cotação de material, estoque, aportes, despesas com comprovante e prestação de contas ao cliente, com agentes de IA.",
    headline: "Gestão de obra,",
    headlineFim: "do canteiro à prestação de contas.",
    lede: "Para quem gerencia ou executa obra para o cliente: o diário chega do celular do encarregado, a compra sai de uma cotação comparada e cada despesa entra com comprovante na conta da obra. No fim do mês, a prestação de contas já está montada.",
    dores: [
      {
        titulo: "O dia da obra chega pelo WhatsApp",
        texto:
          "Foto solta, áudio do encarregado e efetivo anotado no papel. Montar o relatório da semana vira trabalho de escritório no sábado.",
      },
      {
        titulo: "Compra sem comparação",
        texto:
          "Três orçamentos em PDF, cada um num formato. Comparar preço e condição exige planilha, e a decisão sai no cansaço.",
      },
      {
        titulo: "Prestação de contas no chute",
        texto:
          "Aporte do cliente, despesa no cartão e taxa de administração em arquivos diferentes. O cliente pergunta o saldo e a resposta demora dias.",
      },
    ],
    frentes: [
      {
        slug: "campo",
        titulo: "O canteiro registra, mesmo sem sinal",
        texto:
          "Clima, efetivo, atividade, foto e quantidade executada pelo navegador do celular. Sem rede, fica no aparelho e sobe quando o sinal volta.",
      },
      {
        slug: "obra",
        titulo: "Cotação, estoque e cronograma",
        texto:
          "Cotação de material com link para o fornecedor responder, estoque da obra e cronograma com o avanço físico do que foi executado.",
      },
      {
        slug: "gestao",
        titulo: "Conta da obra separada",
        texto:
          "Aporte do cliente, despesa com comprovante e taxa de administração na conta da obra, longe do caixa da empresa.",
      },
      {
        slug: "portal",
        titulo: "O cliente acompanha sozinho",
        texto:
          "Andamento, cronograma, registros do diário e prestação de contas no portal, com o acesso que você libera.",
      },
    ],
    paraQuem: [
      "Gerenciadora e quem acompanha obra para o cliente",
      "Obra por administração, com taxa e prestação de contas",
      "Escritório de projeto que também executa ou fiscaliza obra",
      "Usuários ilimitados: o preço é por empresa, não por pessoa",
    ],
    naoE: [
      "Não é ERP de incorporadora nem controla venda de unidades",
      "Não substitui o orçamento executivo nem o software de planejamento de grande obra",
      "Não faz nada sem a aprovação de alguém da equipe",
    ],
    faq: [
      {
        pergunta: "O encarregado precisa de e-mail para usar o Pilar Campo?",
        resposta:
          "Não. O gestor cria usuário e senha para ele, com acesso limitado à obra. O registro é feito pelo navegador do celular.",
      },
      {
        pergunta: "Funciona em obra sem sinal?",
        resposta:
          "Funciona. O registro do dia e as fotos ficam guardados no aparelho e sobem sozinhos quando a conexão volta, sem duplicar.",
      },
      {
        pergunta: "Consigo prestar contas ao cliente pela Pilar?",
        resposta:
          "Sim. A conta da obra reúne aportes, despesas com comprovante e a taxa de administração, e o cliente consulta tudo no portal.",
      },
      {
        pergunta: "O que os agentes de IA fazem na obra?",
        resposta:
          "Leem o orçamento do fornecedor em PDF ou foto e transformam em itens da cotação, e montam a lista de itens de uma estimativa a partir da descrição da obra. Você confere antes de gravar.",
      },
    ],
    artigos: ["obra-por-administracao-prestacao-de-contas", "diario-de-obra-rdo", "taxa-de-administracao-de-obra"],
  },
  {
    slug: "sob-medida",
    tituloSeo: "Sistema de gestão para marcenaria, móveis planejados e marmoraria",
    descricao:
      "Sistema de gestão para marcenaria, móveis planejados e marmoraria: orçamento, etapas de medição, produção e instalação, parcelas e portal do cliente, com agentes de IA.",
    headline: "Gestão para quem projeta e fabrica sob medida,",
    headlineFim: "do orçamento à instalação.",
    lede: "Marcenaria, móveis planejados e marmoraria vendem projeto antes de fabricar. A Pilar organiza o orçamento, as etapas de medição, produção e instalação, as parcelas do cliente e o que ele acompanha, num lugar só.",
    dores: [
      {
        titulo: "Orçamento refeito a cada ajuste",
        texto:
          "O cliente muda um ambiente e o orçamento volta para a planilha. A versão que ele aprovou nem sempre é a que chega na produção.",
      },
      {
        titulo: "Prazo que ninguém enxerga",
        texto:
          "Medição, projeto, aprovação, produção e instalação passam por pessoas diferentes. O atraso aparece no dia da montagem.",
      },
      {
        titulo: "Sinal e parcela soltos",
        texto:
          "Entrada no PIX, parcelas no cartão, saldo na entrega. Saber quanto cada pedido ainda deve exige conferir extrato.",
      },
    ],
    frentes: [
      {
        slug: "gestao",
        titulo: "Do contato ao orçamento aprovado",
        texto:
          "Funil de leads, cliente cadastrado com CPF ou CNPJ e proposta com cada ambiente ou peça separada, no modelo da empresa. Aprovou, vira projeto e parcelas.",
      },
      {
        slug: "projetos",
        titulo: "Etapas com prazo e responsável",
        texto:
          "Quadro com as colunas da sua operação, como medição, projeto, produção e instalação, cada uma com responsável e prazo.",
      },
      {
        slug: "portal",
        titulo: "O cliente sabe em que etapa está",
        texto: "O cliente abre o portal e vê a etapa do pedido, os arquivos que você liberou e as parcelas.",
      },
      {
        slug: "obra",
        titulo: "Instalação registrada",
        texto: "Quando a instalação vira obra na Pilar, a equipe registra a montagem com foto pelo celular.",
      },
    ],
    paraQuem: [
      "Marcenaria e fábrica de móveis planejados",
      "Marmoraria que mede, projeta e instala",
      "Quem vende por orçamento e recebe em parcelas",
      "Usuários ilimitados: o preço é por empresa, não por pessoa",
    ],
    naoE: [
      "Não é software de projeto 3D nem de plano de corte",
      "Não controla a produção da fábrica máquina a máquina",
      "Não faz nada sem a aprovação de alguém da equipe",
    ],
    faq: [
      {
        pergunta: "A Pilar serve para marcenaria e marmoraria?",
        resposta:
          "Serve. O fluxo de orçamento, etapa com prazo, parcela e acompanhamento do cliente é o mesmo de quem vende projeto e depois executa.",
      },
      {
        pergunta: "Consigo usar as etapas da minha operação?",
        resposta:
          "Sim. O quadro usa as colunas que você define, como medição, projeto, aprovação, produção e instalação.",
      },
      {
        pergunta: "Substitui o software de projeto ou de plano de corte?",
        resposta:
          "Não. A Pilar cuida da gestão: orçamento, prazo, financeiro e cliente. O desenho continua nas ferramentas que a equipe já usa.",
      },
      {
        pergunta: "Quanto custa?",
        resposta: "Os planos estão na página de preços, com valor por empresa e usuários ilimitados.",
      },
    ],
    artigos: ["contrato-de-projeto", "cronograma-projeto-arquitetura", "portal-do-cliente-arquitetura"],
  },
];

export const PUBLICOS_POR_SLUG = Object.fromEntries(PUBLICOS.map((p) => [p.slug, p])) as Record<PublicoSlug, Publico>;

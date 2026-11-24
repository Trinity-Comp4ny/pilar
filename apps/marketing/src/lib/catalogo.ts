export const AREAS = [
  {
    id: "gestao",
    titulo: "Gestão",
    href: "/gestao",
    resumo: "Do primeiro contato ao recebimento.",
    recursos: [
      "Funil de leads, atividades e carteira de clientes",
      "Propostas por disciplina e documento no modelo do escritório",
      "Lançamentos, extratos, contas, cartões e faturas",
      "Tarefas, agenda, equipe, metas e apontamento de horas",
      "Folha de pagamento e relatórios financeiros",
    ],
  },
  {
    id: "projetos",
    titulo: "Projetos",
    href: "/projetos",
    resumo: "Coordene a carteira e o trabalho por disciplina.",
    recursos: [
      "Quadro, lista e visão da carteira",
      "Responsáveis, etapas, prazos e dependências",
      "Cronograma, calendário e mapa",
      "Escopo, aditivos, revisões e histórico",
      "Tarefas, arquivos, parcelas e rentabilidade",
    ],
  },
  {
    id: "obra",
    titulo: "Obra",
    href: "/obra",
    resumo: "Acompanhe a execução e as despesas do canteiro.",
    recursos: [
      "Diário de obra, efetivo, fotos e medições",
      "Cronograma, tarefas e relatórios de obra",
      "Fornecedores, cotação de materiais e estoque",
      "Aportes, despesas, comprovantes e taxa de administração",
    ],
  },
  {
    id: "campo",
    titulo: "Pilar Campo",
    href: "/campo",
    resumo: "O registro sai do canteiro e chega ao escritório.",
    recursos: [
      "Acesso da equipe de campo por obra",
      "Registro do dia, atividades, fotos e quantidades",
      "Fila offline e sincronização quando a conexão volta",
    ],
  },
  {
    id: "portal",
    titulo: "Portal do Cliente",
    href: "/portal",
    resumo: "Centralize o que o escritório compartilha com o cliente.",
    recursos: [
      "Acompanhamento de projetos, entregas e arquivos",
      "Andamento da obra, cronograma e registros do diário",
      "Parcelas do projeto e prestação de contas da obra",
    ],
  },
  {
    id: "agentes",
    titulo: "Agentes de IA",
    href: "/funcionalidades/agentes",
    resumo: "Prepare ações em linguagem natural e confira antes de confirmar.",
    recursos: [
      "Registro de receitas e despesas",
      "Apoio à classificação de extratos e faturas",
      "Revisão dos dados antes da confirmação",
    ],
  },
] as const;

export const PAGINAS_RECURSO = [
  {
    slug: "propostas",
    area: "gestao",
    titulo: "Propostas de engenharia por disciplina",
    descricao: "Monte o escopo por disciplina e gere a proposta no modelo do escritório.",
    passos: [
      "Organize entregáveis, escopo e valor de cada disciplina.",
      "Gere o documento no modelo do escritório.",
      "Acompanhe a proposta e consulte o projeto e as parcelas quando a conversão for realizada.",
    ],
    guia: "/blog/proposta-projeto-engenharia",
    ferramenta: "/ferramentas/modelo-de-proposta",
    mock: "kanban",
  },
  {
    slug: "financeiro",
    area: "gestao",
    titulo: "Financeiro para escritórios de engenharia",
    descricao: "Veja lançamentos, saldos e parcelas de contratos no mesmo sistema.",
    passos: [
      "Identifique os recebimentos vinculados aos seus projetos.",
      "Organize receitas, despesas, contas e cartões.",
      "Confira os lançamentos e consulte a visão geral do escritório.",
    ],
    guia: "/blog/fluxo-de-caixa-escritorio-engenharia",
    mock: "financeiro",
  },
  {
    slug: "disciplinas",
    area: "projetos",
    titulo: "Gestão de projetos por disciplina",
    descricao: "Coordene estrutural, elétrica e as demais disciplinas com responsáveis e prazos.",
    passos: [
      "Compare o andamento das disciplinas no quadro ou na lista.",
      "Consulte responsáveis, etapas e impedimentos no detalhe.",
      "Veja os prazos na carteira e identifique o que depende daquela entrega.",
    ],
    guia: "/blog/controle-prazo-projetos-disciplinas",
    mock: "quadro",
  },
  {
    slug: "cronograma",
    area: "projetos",
    titulo: "Cronograma de projetos de engenharia",
    descricao: "Acompanhe a carteira de projetos e visualize entregas e dependências.",
    passos: [
      "Abra o cronograma da carteira.",
      "Localize as entregas e os responsáveis.",
      "Consulte o impacto de uma mudança de prazo nas próximas etapas.",
    ],
    guia: "/blog/cronograma-projeto-arquitetura",
    mock: "gantt",
  },
  {
    slug: "diario-de-obra",
    area: "obra",
    titulo: "Diário de obra digital",
    descricao: "Reúna registros do canteiro, fotos, efetivo e medições no diário da obra.",
    passos: [
      "Registre o dia no campo com a equipe e as atividades.",
      "Sincronize os registros quando houver conexão.",
      "Consulte o diário no escritório e reúna os registros para o relatório.",
    ],
    guia: "/blog/diario-de-obra-rdo",
    mock: "diario",
  },
  {
    slug: "prestacao-de-contas",
    area: "obra",
    titulo: "Prestação de contas de obras por administração",
    descricao: "Acompanhe aportes, despesas, comprovantes, taxa de administração e saldo.",
    passos: [
      "Registre o aporte recebido do cliente.",
      "Associe as despesas e seus comprovantes à obra.",
      "Confira o saldo e a taxa antes de apresentar a prestação de contas.",
    ],
    guia: "/blog/taxa-de-administracao-de-obra",
    mock: "conta-obra",
  },
] as const;

export const caminhoRecurso = (slug: string) => `/funcionalidades/${slug}`;

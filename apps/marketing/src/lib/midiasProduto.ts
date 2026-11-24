import type { Midia } from "../components/MidiaProduto";

export const MIDIAS_PRODUTO: Readonly<Partial<Record<string, Midia>>> = {
  gestao: {
    print: { arquivo: "painel", descricao: "Painel inicial da Pilar com indicadores de Gestão e Projetos." },
    video: { arquivo: "comercial", descricao: "O vídeo percorre o funil comercial e abre a lista de propostas." },
  },
  crm: {
    print: { arquivo: "leads", descricao: "Quadro de leads da Pilar com etapas e indicadores do funil." },
    video: {
      arquivo: "comercial",
      descricao: "O vídeo mostra o quadro de leads e a passagem para a lista de propostas.",
    },
  },
  propostas: {
    print: { arquivo: "propostas", descricao: "Lista de propostas da Pilar com cliente, valor, status e validade." },
    video: { arquivo: "comercial", descricao: "O vídeo sai do funil e abre a lista de propostas do escritório." },
  },
  financeiro: {
    print: { arquivo: "financeiro", descricao: "Visão financeira com lucro, receitas, despesas e contas a receber." },
    video: {
      arquivo: "financeiro",
      descricao: "O vídeo destaca o lucro líquido e os valores a receber no painel financeiro.",
    },
  },
  projetos: {
    print: {
      arquivo: "projetos",
      descricao: "Quadro de projetos agrupados por etapa, com prioridades e indicadores da carteira.",
    },
    video: {
      arquivo: "projetos",
      descricao: "O vídeo abre um projeto da carteira e localiza a margem bruta no detalhe.",
    },
  },
  disciplinas: {
    print: {
      arquivo: "disciplinas",
      descricao: "Detalhe de um projeto com tabela de disciplinas, responsáveis, status e prazos.",
    },
  },
  rentabilidade: {
    video: {
      arquivo: "projetos",
      descricao: "O vídeo abre um projeto da carteira e destaca a margem bruta no detalhe.",
    },
  },
  "escopo-e-aditivos": {
    video: {
      arquivo: "escopo",
      descricao: "O vídeo abre a área de escopo e mostra um aditivo de exemplo sobre dutos.",
    },
  },
  obra: {
    print: { arquivo: "obra", descricao: "Tela de uma obra com avanço, cronograma e registros recentes do diário." },
    video: {
      arquivo: "obra",
      descricao: "O vídeo percorre a visão da obra e mostra o alerta de clima e a curva de avanço.",
    },
  },
  "cronograma-de-obra": {
    video: {
      arquivo: "cronograma-obra",
      descricao: "O vídeo abre o cronograma da obra e destaca uma atividade de concretagem.",
    },
  },
  "diario-de-obra": {
    video: {
      arquivo: "diario",
      descricao: "O vídeo abre o diário no escritório e localiza um registro de concretagem.",
    },
  },
  "campo-offline": {
    video: {
      arquivo: "campo-sincronizacao",
      descricao: "Demonstração do diário salvo sem conexão e sincronizado quando a rede volta.",
    },
  },
  "agente-estimativas": {
    print: {
      arquivo: "estimativas",
      formato: "jpg",
      largura: 1440,
      altura: 2800,
      descricao: "Aba de custos de uma estimativa de exemplo com composição por etapa.",
    },
  },
  campo: {
    video: {
      arquivo: "campo-sincronizacao",
      descricao: "Demonstração local do diário salvo sem conexão e sincronizado após a volta da rede.",
    },
  },
  "agente-confirmacao": {
    video: {
      arquivo: "agente-confirmacao",
      descricao: "Demonstração local da revisão do rascunho e confirmação de uma receita de teste.",
    },
  },
  portal: {
    video: {
      arquivo: "portal-demonstracao",
      descricao: "Demonstração local da visão do cliente, do painel aos projetos, parcelas e obras.",
    },
    print: {
      arquivo: "portal-projetos",
      formato: "jpg",
      largura: 1800,
      altura: 612,
      descricao: "Comparação de duas versões da tela de projeto e pendências no Portal do Cliente.",
    },
  },
  "portal-de-projetos": {
    print: {
      arquivo: "portal-projetos",
      formato: "jpg",
      largura: 1800,
      altura: 612,
      descricao: "Comparação da visão de projeto e das pendências no Portal do Cliente.",
    },
  },
  "portal-de-obras": {
    print: {
      arquivo: "portal-obras",
      formato: "jpg",
      largura: 1800,
      altura: 1110,
      descricao: "Comparação da visão geral da obra no Portal do Cliente, com andamento e próximas etapas.",
    },
  },
  "portal-financeiro": {
    print: {
      arquivo: "portal-financeiro",
      formato: "jpg",
      largura: 1800,
      altura: 612,
      descricao: "Comparação de duas versões da tela de parcelas e progresso financeiro no Portal do Cliente.",
    },
  },
  "estimativas-de-obra": {
    print: {
      arquivo: "estimativas",
      formato: "jpg",
      largura: 1440,
      altura: 2800,
      descricao: "Aba de custos de uma estimativa de exemplo com composição por etapa.",
    },
  },
  agentes: {
    print: {
      arquivo: "agentes",
      descricao: "Tela de Agentes da Pilar com conversa, seleção de projeto e acesso a pendências.",
    },
    video: {
      arquivo: "agentes",
      descricao: "O vídeo abre a fila de pendências e apresenta avisos de recebimento atrasado e tarefas de obra.",
    },
  },
};

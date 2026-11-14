/**
 * Índice da central de ajuda (SPEC 154). Uma entrada por artigo; o texto fica em
 * `src/content/ajuda/<slug>.md`. `rotas` liga o artigo ao "?" do cabeçalho das telas e é
 * conferido contra o App em scripts/ajuda-artigos.test.ts.
 *
 * Artigo ensina o caminho real da tela: PR que muda esse caminho atualiza o artigo junto.
 */
export type GrupoAjuda = "comecar" | "comercial" | "projetos" | "financeiro" | "equipe";

export const GRUPOS_AJUDA: readonly { id: GrupoAjuda; label: string }[] = [
  { id: "comecar", label: "Primeiros passos" },
  { id: "comercial", label: "Leads, propostas e clientes" },
  { id: "projetos", label: "Projetos" },
  { id: "financeiro", label: "Financeiro" },
  { id: "equipe", label: "Equipe e conta" },
];

export interface ArtigoAjuda {
  slug: string;
  titulo: string;
  resumo: string;
  grupo: GrupoAjuda;
  /** Telas em que o artigo aparece no "?" (a rota cobre as telas abaixo dela). */
  rotas: string[];
  /** Termos que a pessoa pode digitar na busca e não estão no título. */
  palavras: string[];
}

/** Nome da tela no botão "Ir para ..." do agente e do artigo. */
export const NOME_DA_TELA: Record<string, string> = {
  "/gestao/leads": "Leads",
  "/gestao/propostas": "Propostas",
  "/gestao/clientes": "Clientes",
  "/gestao/financeiro": "Financeiro",
  "/gestao/equipe": "Equipe",
  "/projetos": "Projetos",
  "/novidades": "Novidades",
};

export const ARTIGOS: readonly ArtigoAjuda[] = [
  {
    slug: "busca-rapida",
    titulo: "Achar qualquer coisa com a busca rápida (⌘K)",
    resumo: "Abrir clientes, projetos e propostas de qualquer tela pelo teclado.",
    grupo: "comecar",
    rotas: [],
    palavras: ["buscar", "procurar", "atalho", "teclado", "ctrl k", "favoritos", "recentes"],
  },
  {
    slug: "feedback-e-novidades",
    titulo: "Mandar feedback e ver o que mudou",
    resumo: "Reportar problema, sugerir melhoria e acompanhar as novidades da Pilar.",
    grupo: "comecar",
    rotas: ["/novidades"],
    palavras: ["bug", "erro", "problema", "sugestão", "melhoria", "suporte", "novidades", "atualização"],
  },
  {
    slug: "preferencias-de-notificacao",
    titulo: "Escolher o que chega no sino e por e-mail",
    resumo: "Ligar e desligar avisos por categoria, no app e por e-mail.",
    grupo: "comecar",
    rotas: [],
    palavras: ["notificação", "aviso", "sino", "email", "e-mail", "alerta", "resumo semanal"],
  },
  {
    slug: "criar-lead",
    titulo: "Criar um lead",
    resumo: "Cadastrar um contato que ainda está negociando com o escritório.",
    grupo: "comercial",
    rotas: ["/gestao/leads"],
    palavras: ["prospect", "contato", "oportunidade", "comercial", "novo lead"],
  },
  {
    slug: "funil-de-leads",
    titulo: "Mover o lead no funil e fechar o negócio",
    resumo: "Mudar de etapa, registrar ganho ou perda e converter em cliente, proposta ou projeto.",
    grupo: "comercial",
    rotas: ["/gestao/leads"],
    palavras: ["kanban", "etapa", "coluna", "ganho", "perdido", "converter", "transformar em cliente"],
  },
  {
    slug: "criar-e-enviar-proposta",
    titulo: "Criar e enviar uma proposta",
    resumo: "Montar a proposta, gerar o documento pelo template e enviar por e-mail.",
    grupo: "comercial",
    rotas: ["/gestao/propostas"],
    palavras: ["orçamento", "orcamento", "documento", "template", "contrato", "enviar", "aceita", "recusada"],
  },
  {
    slug: "cadastrar-cliente",
    titulo: "Cadastrar um cliente",
    resumo: "Pessoa física ou jurídica, com contato, endereço e dados bancários.",
    grupo: "comercial",
    rotas: ["/gestao/clientes"],
    palavras: ["cnpj", "cpf", "empresa", "contratante", "novo cliente"],
  },
  {
    slug: "portal-do-cliente",
    titulo: "Dar acesso ao portal do cliente",
    resumo: "Criar o login para o cliente acompanhar os projetos.",
    grupo: "comercial",
    rotas: ["/gestao/clientes"],
    palavras: ["portal", "acesso", "login", "senha", "cliente acompanhar"],
  },
  {
    slug: "criar-projeto",
    titulo: "Criar um projeto",
    resumo: "Identificação, escopo, prazos e disciplinas do trabalho contratado.",
    grupo: "projetos",
    rotas: ["/projetos"],
    palavras: ["novo projeto", "disciplina", "escopo", "prazo", "fluxo", "template"],
  },
  {
    slug: "lancar-receita-ou-despesa",
    titulo: "Lançar uma receita ou despesa",
    resumo: "Registrar o que entra e sai, à vista, parcelado ou recorrente.",
    grupo: "financeiro",
    rotas: ["/gestao/financeiro"],
    palavras: ["lançamento", "lancamento", "pagar", "receber", "conta", "parcela", "recorrente", "importar", "extrato"],
  },
  {
    slug: "pagar-fatura-do-cartao",
    titulo: "Pagar a fatura do cartão",
    resumo: "Quitar a fatura do cartão de crédito do escritório pela Carteira.",
    grupo: "financeiro",
    rotas: ["/gestao/financeiro"],
    palavras: ["fatura", "cartão", "cartao", "crédito", "carteira"],
  },
  {
    slug: "convidar-equipe",
    titulo: "Cadastrar alguém da equipe e dar acesso",
    resumo: "Incluir a pessoa na equipe e mandar o convite para entrar na Pilar.",
    grupo: "equipe",
    rotas: ["/gestao/equipe"],
    palavras: ["convite", "convidar", "usuário", "usuario", "pessoa", "colaborador", "acesso", "membro"],
  },
];

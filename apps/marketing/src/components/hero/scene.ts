/**
 * Roteiro da cena da hero (SPEC 072).
 *
 * A cena é uma sessão contínua no Pilar conduzida por um agente: ele escreve o
 * pedido em português, monta o lançamento, pede aprovação, o lead fecha e vira
 * projeto, a receita entra no financeiro, a margem e o cronograma do projeto
 * aparecem, e a obra recebe o diário do campo. É a tagline ("gestão com agentes
 * de IA para escritórios de engenharia e arquitetura") mostrada em vinte segundos,
 * sem o visitante clicar em nada.
 *
 * As coordenadas são em pixels de um palco fixo de 1120x680, que o `HeroScene`
 * escala por CSS para caber no container. Assim a posição do cursor é um número
 * literal, e o enquadramento é idêntico em qualquer tela.
 */

export const PALCO = { largura: 1120, altura: 700 };

/** Nomes na ordem em que acontecem. O índice do relógio indexa este array. */
export const ATOS = [
  "repouso",
  "vaiAgentes",
  "clicaAgentes",
  "digita",
  "pensa",
  "rascunho",
  "vaiConfirmar",
  "confirma",
  "vaiLeads",
  "funil",
  "converte",
  "convertido",
  "vaiFinanceiro",
  "financeiro",
  "vaiProjetos",
  "projeto",
  "gantt",
  "vaiObras",
  "obra",
  "respira",
] as const;

export type Ato = (typeof ATOS)[number];

/**
 * Ritmo de demonstração, não de uso real: cada tela fica o suficiente para ser
 * lida e passa. A versão anterior levava 32s e deixava o agente "pensando" por
 * quase dois segundos; aqui a volta inteira cabe em ~20s e passa por Gestão,
 * Projetos e Obras.
 */
export const MARCOS = [
  0, // repouso, no funil
  600, // vaiAgentes
  1100, // clicaAgentes
  1500, // digita
  2750, // pensa
  3150, // rascunho
  4250, // vaiConfirmar
  4750, // confirma
  5550, // vaiLeads
  6100, // funil: o lead cai em Ganho
  6900, // converte: o app pergunta se vira projeto
  7700, // convertido
  8900, // vaiFinanceiro
  9400, // financeiro
  11300, // vaiProjetos
  11800, // projeto
  13500, // gantt
  15300, // vaiObras
  15800, // obra
  19300, // respira
] as const;

export const DURACAO_LOOP = 20600;

/** Velocidade da digitação do pedido, em ms por caractere. */
export const MS_POR_CHAR = 18;

/** Índice de um ato, para comparar com o índice publicado pelo relógio. */
export const idx = (ato: Ato) => ATOS.indexOf(ato);

export const FRASE = "Recebi 128 mil do centro cirúrgico, primeira de três parcelas";

/** Onde o cursor está em cada ato, e o rótulo que ele carrega. */
export const CURSOR: Record<Ato, { x: number; y: number; rotulo: string | null }> = {
  repouso: { x: 690, y: 300, rotulo: null },
  vaiAgentes: { x: 40, y: 362, rotulo: "Agente" },
  clicaAgentes: { x: 40, y: 362, rotulo: "Abrindo os agentes" },
  digita: { x: 660, y: 470, rotulo: "Escrevendo o pedido" },
  pensa: { x: 660, y: 430, rotulo: "Lendo o pedido" },
  rascunho: { x: 700, y: 380, rotulo: "Montando o lançamento" },
  vaiConfirmar: { x: 650, y: 394, rotulo: "Aguardando você" },
  confirma: { x: 650, y: 394, rotulo: "Aprovado" },
  vaiLeads: { x: 128, y: 340, rotulo: "Atualizando o funil" },
  funil: { x: 860, y: 300, rotulo: "Lead ganho" },
  converte: { x: 800, y: 418, rotulo: "Converter em projeto" },
  convertido: { x: 800, y: 418, rotulo: "Projeto criado" },
  vaiFinanceiro: { x: 128, y: 192, rotulo: "Conferindo o caixa" },
  financeiro: { x: 128, y: 192, rotulo: "Conferindo o caixa" },
  vaiProjetos: { x: 38, y: 220, rotulo: "Recalculando a margem" },
  projeto: { x: 38, y: 220, rotulo: "Recalculando a margem" },
  gantt: { x: 1022, y: 318, rotulo: "Abrindo o cronograma" },
  vaiObras: { x: 38, y: 282, rotulo: "Indo para a obra" },
  obra: { x: 880, y: 300, rotulo: "Diário chegou do campo" },
  respira: { x: 680, y: 320, rotulo: null },
};

/** Qual tela do produto está no palco em cada ato. */
export function telaDoAto(i: number): "agentes" | "funil" | "financeiro" | "projeto" | "obra" {
  if (i >= idx("vaiObras")) return "obra";
  if (i >= idx("vaiProjetos")) return "projeto";
  if (i >= idx("vaiFinanceiro")) return "financeiro";
  if (i >= idx("vaiLeads")) return "funil";
  if (i >= idx("clicaAgentes")) return "agentes";
  return "funil";
}

/** Item do trilho em destaque, acompanhando a tela. */
export function moduloAtivo(i: number): string {
  const tela = telaDoAto(i);
  if (tela === "obra") return "Obras";
  if (tela === "projeto") return i >= idx("gantt") ? "Cronograma" : "Projetos";
  if (tela === "financeiro") return "Financeiro";
  if (tela === "agentes") return "Agentes";
  return "Leads";
}

/**
 * Navegação do mock, copiada da real (`src/lib/modules.ts` do app).
 *
 * O app tem um trilho fixo (Início, os três módulos, Agentes) e, ao lado, um
 * painel com os itens do módulo aberto, agrupados por rótulo. A cena mostra
 * os três módulos: Gestão (funil e caixa), Projetos (margem e cronograma) e
 * Obras (diário vindo do campo).
 */
export const MODULOS_APP = ["Gestão", "Projetos", "Obras"] as const;

/** Itens de cada módulo, na ordem do app. Gestão agrupa; Projetos e Obras não. */
export const NAV_POR_MODULO: Record<string, { nome: string; grupo?: string }[]> = {
  Gestão: [
    { nome: "Tarefas", grupo: "Empresa" },
    { nome: "Financeiro", grupo: "Empresa" },
    { nome: "Equipe", grupo: "Empresa" },
    { nome: "Metas", grupo: "Empresa" },
    { nome: "Leads", grupo: "Comercial" },
    { nome: "Clientes", grupo: "Comercial" },
    { nome: "Propostas", grupo: "Comercial" },
  ],
  Projetos: [{ nome: "Projetos" }, { nome: "Disciplinas" }, { nome: "Cronograma" }, { nome: "Mapa" }],
  Obras: [{ nome: "Obras" }, { nome: "Estimativas" }, { nome: "Fornecedores" }, { nome: "Clima" }],
};

/**
 * Módulo aberto no trilho. A tela de projeto vive sob Projetos no app, então o
 * painel troca junto: seria falso mostrar o menu de Gestão com um breadcrumb de
 * Projetos no cabeçalho. Agentes não tem painel próprio: o app mantém o do
 * módulo anterior (Gestão, aqui).
 */
export function moduloAppAtivo(i: number): string {
  const tela = telaDoAto(i);
  if (tela === "obra") return "Obras";
  return tela === "projeto" ? "Projetos" : "Gestão";
}

export const COLUNAS: { nome: string; dot: string; cards: { titulo: string; empresa: string; valor: string }[] }[] = [
  {
    nome: "Novo",
    dot: "bg-pipeline-novo",
    cards: [{ titulo: "Reforma de laboratório", empresa: "Bioteste", valor: "R$ 38.500" }],
  },
  {
    nome: "Em Contato",
    dot: "bg-pipeline-contato",
    cards: [
      { titulo: "Retrofit elétrico", empresa: "Hospital Santa Rita", valor: "R$ 84.000" },
      { titulo: "SPDA de galpão", empresa: "Log Sul", valor: "R$ 21.500" },
    ],
  },
  {
    nome: "Proposta Enviada",
    dot: "bg-pipeline-negociacao",
    cards: [{ titulo: "Gases medicinais", empresa: "Clínica Vitta", valor: "R$ 56.000" }],
  },
  {
    nome: "Em Negociação",
    dot: "bg-brand",
    cards: [{ titulo: "Fotovoltaico", empresa: "Cond. Alvorada", valor: "R$ 71.200" }],
  },
  { nome: "Ganho", dot: "bg-status-done", cards: [] },
  { nome: "Perdido", dot: "bg-pipeline-perdido", cards: [] },
];

/** O lead que o agente move: sai de "Proposta Enviada" e cai em "Ganho". */
export const LEAD_HEROI = {
  titulo: "Climatização de centro cirúrgico",
  empresa: "Hospital Santa Rita",
  valor: "R$ 128.400",
};

/** Os cinco KPIs do topo do funil, com os rótulos exatos do app. */
export const KPIS_LEADS: { rotulo: string; valor: string; tom?: "positivo" }[] = [
  { rotulo: "Pipeline ativo", valor: "12" },
  { rotulo: "Valor no funil", valor: "R$ 399.600", tom: "positivo" },
  { rotulo: "Fecham em 7 dias", valor: "3" },
  { rotulo: "Conversão de leads", valor: "62%", tom: "positivo" },
  { rotulo: "Fechamento de propostas", valor: "45%" },
];

/** Os cinco KPIs da Visão Geral do Financeiro, na ordem real. */
export const KPIS_FINANCEIRO: { rotulo: string; valor: number; sub: string; tom: "positivo" | "negativo" }[] = [
  { rotulo: "Lucro líquido", valor: 148450, sub: "Margem de 31,4%", tom: "positivo" },
  { rotulo: "Receitas totais", valor: 412900, sub: "18% vs período anterior", tom: "positivo" },
  { rotulo: "Despesas totais", valor: 264450, sub: "6% vs período anterior", tom: "negativo" },
  { rotulo: "A receber", valor: 268300, sub: "9 lançamentos pendentes", tom: "positivo" },
  { rotulo: "A pagar", valor: 74100, sub: "4 lançamentos pendentes", tom: "negativo" },
];

/** Itens da barra secundária do Financeiro. */
export const MENU_FINANCEIRO = ["Visão Geral", "Lançamentos", "Folha de Pagamento", "Carteira", "Relatórios"] as const;

export const RASCUNHO = [
  ["Projeto", "Climatização, centro cirúrgico"],
  ["Categoria", "Receita de projeto"],
  ["Valor", "R$ 128.400,00"],
  ["Parcela", "1 de 3, vence 18/09"],
] as const;

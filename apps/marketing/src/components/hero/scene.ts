/**
 * Roteiro da cena da hero (SPEC 060).
 *
 * A cena é uma sessão contínua no Pilar conduzida por um agente: ele escreve o
 * pedido em português, monta o lançamento, pede aprovação, o lead atravessa o
 * funil, a receita entra no financeiro e a margem do projeto é recalculada. É a
 * tagline inteira ("saiba se cada projeto está dando lucro") em vinte segundos,
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
  "vaiCopiloto",
  "clicaCopiloto",
  "digita",
  "pensa",
  "rascunho",
  "vaiConfirmar",
  "confirma",
  "funil",
  "vaiFinanceiro",
  "financeiro",
  "vaiProjeto",
  "projeto",
  "respira",
] as const;

export type Ato = (typeof ATOS)[number];

export const MARCOS = [
  0, // repouso
  500, // vaiCopiloto
  1350, // clicaCopiloto
  1650, // digita
  4600, // pensa
  5500, // rascunho
  7300, // vaiConfirmar
  8150, // confirma
  8800, // funil
  10400, // vaiFinanceiro
  11250, // financeiro
  13900, // vaiProjeto
  14750, // projeto
  17300, // respira
] as const;

export const DURACAO_LOOP = 19800;

/** Índice de um ato, para comparar com o índice publicado pelo relógio. */
export const idx = (ato: Ato) => ATOS.indexOf(ato);

export const FRASE = "Recebi 128 mil do centro cirúrgico, primeira de três parcelas";

/** Onde o cursor está em cada ato, e o rótulo que ele carrega. */
export const CURSOR: Record<Ato, { x: number; y: number; rotulo: string | null }> = {
  repouso: { x: 686, y: 250, rotulo: null },
  vaiCopiloto: { x: 470, y: 616, rotulo: "Agente" },
  clicaCopiloto: { x: 470, y: 616, rotulo: "Agente" },
  digita: { x: 470, y: 616, rotulo: "Escrevendo o pedido" },
  pensa: { x: 618, y: 500, rotulo: "Lendo o pedido" },
  rascunho: { x: 700, y: 430, rotulo: "Montando o lançamento" },
  vaiConfirmar: { x: 958, y: 543, rotulo: "Aguardando você" },
  confirma: { x: 958, y: 543, rotulo: "Aprovado" },
  funil: { x: 800, y: 300, rotulo: "Atualizando o funil" },
  vaiFinanceiro: { x: 104, y: 344, rotulo: "Conferindo o caixa" },
  financeiro: { x: 104, y: 344, rotulo: "Conferindo o caixa" },
  vaiProjeto: { x: 104, y: 288, rotulo: "Recalculando a margem" },
  projeto: { x: 104, y: 288, rotulo: "Recalculando a margem" },
  respira: { x: 660, y: 260, rotulo: null },
};

/** Qual tela do produto está no palco em cada ato. */
export function telaDoAto(i: number): "funil" | "financeiro" | "projeto" {
  if (i >= idx("vaiProjeto")) return "projeto";
  if (i >= idx("vaiFinanceiro")) return "financeiro";
  return "funil";
}

/** Item da barra lateral em destaque, acompanhando a tela. */
/** Item do menu em destaque, acompanhando a tela. */
export function moduloAtivo(i: number): string {
  const tela = telaDoAto(i);
  if (tela === "projeto") return "Projetos";
  if (tela === "financeiro") return "Financeiro";
  return "Leads";
}

/**
 * Navegação do mock, copiada da real (`src/lib/modules.ts` do app).
 *
 * O app não tem uma lista plana: tem um seletor de módulo (Gestão, Projetos,
 * Obras) e, dentro do módulo escolhido, itens agrupados por rótulo. A cena
 * mostra o módulo Gestão aberto, que é onde a história acontece.
 */
export const MODULOS_APP = ["Gestão", "Projetos", "Obras"] as const;

/** Itens de cada módulo, na ordem do app. Gestão agrupa; Projetos não. */
export const NAV_POR_MODULO: Record<string, { nome: string; grupo?: string }[]> = {
  Gestão: [
    { nome: "Meu trabalho", grupo: "Empresa" },
    { nome: "Financeiro", grupo: "Empresa" },
    { nome: "Equipe", grupo: "Empresa" },
    { nome: "Metas", grupo: "Empresa" },
    { nome: "Leads", grupo: "Comercial" },
    { nome: "Clientes", grupo: "Comercial" },
    { nome: "Propostas", grupo: "Comercial" },
  ],
  Projetos: [{ nome: "Projetos" }, { nome: "Disciplinas" }, { nome: "Cronograma" }, { nome: "Mapa" }],
};

/**
 * Módulo aberto no seletor. A tela de projeto vive sob Projetos no app, então a
 * barra lateral troca junto: seria falso mostrar o menu de Gestão com um
 * breadcrumb de Projetos no cabeçalho.
 */
export function moduloAppAtivo(i: number): string {
  return telaDoAto(i) === "projeto" ? "Projetos" : "Gestão";
}

export const COLUNAS: { nome: string; dot: string; cards: { titulo: string; empresa: string; valor: string }[] }[] = [
  { nome: "Novo", dot: "bg-chart-info", cards: [{ titulo: "Reforma de laboratório", empresa: "Bioteste", valor: "R$ 38.500" }] },
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
    dot: "bg-chart-warning",
    cards: [{ titulo: "Gases medicinais", empresa: "Clínica Vitta", valor: "R$ 56.000" }],
  },
  { nome: "Em Negociação", dot: "bg-brand", cards: [{ titulo: "Fotovoltaico", empresa: "Cond. Alvorada", valor: "R$ 71.200" }] },
  { nome: "Ganho", dot: "bg-status-done", cards: [] },
  { nome: "Perdido", dot: "bg-status-cancelled", cards: [] },
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

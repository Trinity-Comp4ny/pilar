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

export const PALCO = { largura: 1120, altura: 680 };

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
export function moduloAtivo(i: number): string {
  const tela = telaDoAto(i);
  if (tela === "projeto") return "Projetos";
  if (tela === "financeiro") return "Financeiro";
  return "Leads";
}

export const NAV = [
  { nome: "Início", grupo: "topo" },
  { nome: "Leads", grupo: "gestao" },
  { nome: "Propostas", grupo: "gestao" },
  { nome: "Projetos", grupo: "gestao" },
  { nome: "Financeiro", grupo: "gestao" },
  { nome: "Obras", grupo: "obra" },
  { nome: "Portal", grupo: "obra" },
] as const;

export const COLUNAS = [
  {
    nome: "Em contato",
    cor: "bg-ink/20",
    cards: [
      { titulo: "Retrofit elétrico, hospital", valor: "R$ 84.000" },
      { titulo: "SPDA, galpão logístico", valor: "R$ 21.500" },
    ],
  },
  {
    nome: "Proposta",
    cor: "bg-modulo-projetos-strong",
    cards: [{ titulo: "Gases medicinais, clínica", valor: "R$ 56.000" }],
  },
  {
    nome: "Negociação",
    cor: "bg-modulo-obra-strong",
    cards: [{ titulo: "Fotovoltaico, condomínio", valor: "R$ 71.200" }],
  },
  { nome: "Ganho", cor: "bg-modulo-gestao-strong", cards: [] },
] as const;

/** O lead que o agente move: sai de "Proposta" e cai em "Ganho". */
export const LEAD_HEROI = { titulo: "Climatização, centro cirúrgico", valor: "R$ 128.400" };

export const RASCUNHO = [
  ["Projeto", "Climatização, centro cirúrgico"],
  ["Categoria", "Receita de projeto"],
  ["Valor", "R$ 128.400,00"],
  ["Parcela", "1 de 3, vence 18/09"],
] as const;

import type { Dor } from "@/lib/onboarding/dores";

/**
 * O que o Pilar faz para cada dor, em linguagem direta e só com o que existe no produto
 * hoje (sem número inventado e sem depoimento: prova social só com cliente autorizado).
 */
export interface PreviaDaDor {
  titulo: string;
  itens: string[];
  onde: string;
}

export const PREVIA_DA_DOR: Record<Dor, PreviaDaDor> = {
  lucro_projeto: {
    titulo: "Lucro de cada projeto à vista",
    itens: [
      "Receitas e despesas lançadas dentro do projeto.",
      "Equipe com custo, ligada às disciplinas do projeto.",
      "Fluxo de caixa e visão mensal do escritório.",
    ],
    onde: "Projetos e Financeiro",
  },
  prazos: {
    titulo: "Prazo de cada entrega sob controle",
    itens: [
      "Disciplinas com responsável e datas em cada projeto.",
      "Fluxo de disciplinas que você define uma vez e reaproveita.",
      "Cronograma do projeto num só lugar.",
    ],
    onde: "Projetos",
  },
  propostas: {
    titulo: "Proposta padronizada, do rascunho ao projeto",
    itens: [
      "Escopo, valor e condições na mesma proposta.",
      "Proposta aprovada vira projeto sem redigitar.",
      "Cada proposta ligada ao cliente.",
    ],
    onde: "Propostas",
  },
  financeiro: {
    titulo: "Financeiro do escritório fora da planilha",
    itens: [
      "Receitas e despesas com cliente e projeto.",
      "Contas e cartões cadastrados.",
      "Visão geral, fluxo e visão mensal.",
    ],
    onde: "Financeiro",
  },
  equipe: {
    titulo: "Quem faz o quê, com histórico",
    itens: [
      "Equipe com disciplina e custo de cada pessoa.",
      "Responsável por disciplina em cada projeto.",
      "Colegas convidados registram no mesmo lugar.",
    ],
    onde: "Pessoas e Projetos",
  },
  cliente_andamento: {
    titulo: "Resposta rápida para o cliente",
    itens: [
      "Cliente cadastrado e ligado a propostas e projetos.",
      "Portal do cliente com o andamento do projeto.",
      "Disciplinas e prazos atualizados por quem executa.",
    ],
    onde: "Clientes, Projetos e Portal do Cliente",
  },
  aditivos: {
    titulo: "Escopo que cresce vira aditivo registrado",
    itens: [
      "Escopo do projeto e aditivos no mesmo lugar.",
      "Proposta aprovada como ponto de partida do escopo.",
      "Parcelas ligadas ao cliente no financeiro.",
    ],
    onde: "Projetos (Escopos e Aditivos)",
  },
  obra: {
    titulo: "Obra acompanhada de perto",
    itens: [
      "Diário de obra e cronograma.",
      "Conta da obra com custos.",
      "Fornecedores cadastrados para cotação e compra.",
    ],
    onde: "Obras",
  },
  espalhado: {
    titulo: "Tudo no mesmo lugar",
    itens: [
      "Clientes, propostas, projetos e financeiro conectados.",
      "Cada pessoa registra onde o time inteiro vê.",
      "Histórico do projeto sem caçar conversa antiga.",
    ],
    onde: "Gestão, Projetos e Obras",
  },
  outra: {
    titulo: "Gestão, projetos e obras no mesmo lugar",
    itens: [
      "Do cliente ao projeto, sem redigitar.",
      "Equipe e prazos visíveis para todos.",
      "Financeiro ligado ao que foi entregue.",
    ],
    onde: "Gestão, Projetos e Obras",
  },
};

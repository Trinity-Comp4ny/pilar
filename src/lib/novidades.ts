// Central de novidades voltada ao usuário (spec 038). A fonte é este array
// versionado no código, preenchido a partir do CHANGELOG.md da raiz. Não
// parseamos o .md em runtime: mantê-lo aqui dá tipo forte e zero custo de I/O.
// Ao promover staging -> main, a seção [Não lançado] do CHANGELOG vira uma versão
// datada; espelhe a mudança aqui (novo release no topo) e atualize ULTIMA_VERSAO.
//
// Versão amigável em SemVer (ex.: 1.1.0): minor = feature, patch = correção,
// major = mudança grande. ULTIMA_VERSAO tem que bater com o "version" do
// package.json (guardado por novidades.test.ts).

export type TipoItem = "novo" | "melhoria" | "correcao";

export type ItemNovidade = {
  tipo: TipoItem;
  texto: string;
};

export type Release = {
  /** Id estável e comparável da versão. Usado como marca de "visto". */
  versao: string;
  titulo: string;
  /** Rótulo amigável de data (ex.: "Agosto de 2026"). */
  data: string;
  itens: ItemNovidade[];
};

// Mais recente primeiro. A seção [Não lançado] do CHANGELOG é o release do topo.
export const NOVIDADES: Release[] = [
  {
    versao: "1.1.0",
    titulo: "Versão 1.1.0",
    data: "Agosto de 2026",
    itens: [
      {
        tipo: "novo",
        texto:
          "Onboarding guiado: checklist de primeiros passos por pilar (Gestão, Projetos, Obras) e tour com dicas nas ações principais.",
      },
      { tipo: "novo", texto: "Busca rápida (⌘K / Ctrl+K) para navegar e criar registros sem sair do teclado." },
      {
        tipo: "novo",
        texto:
          'Selo de frescura do dado ("Atualizado há X", clicável para revalidar) nas telas de dinheiro: Início, Visão Geral, Lançamentos e Rentabilidade.',
      },
      {
        tipo: "novo",
        texto: "Central de notificações in-app, com sino no rodapé da barra lateral e preferências por usuário.",
      },
      { tipo: "novo", texto: "Carteira: visão única que reúne contas e faturas de cartão." },
      {
        tipo: "melhoria",
        texto: "Design system: cores em tokens semânticos, Badge com variantes de status e Button com a cor da marca.",
      },
      {
        tipo: "melhoria",
        texto:
          "Formulários: campos de dinheiro, número e porcentagem com máscara e teclado corretos por primitivos dedicados.",
      },
      { tipo: "melhoria", texto: "Microcopy de botões padronizada em sentence case." },
      {
        tipo: "correcao",
        texto: "Toasts que não apareciam voltaram a disparar: avisos do sistema antigo migraram para o ativo.",
      },
      {
        tipo: "correcao",
        texto:
          "Mensagens de erro que vazavam texto técnico agora são sanitizadas e trazem o próximo passo, em Projetos, Clientes e Financeiro.",
      },
      { tipo: "correcao", texto: "Campos de data (sem hora) deixam de sofrer deslocamento por fuso horário." },
    ],
  },
  {
    versao: "1.0.0",
    titulo: "Primeira versão",
    data: "Lançamento",
    itens: [
      {
        tipo: "novo",
        texto:
          "Plataforma em uso pelos design partners: Dashboard, Projetos, Propostas, Leads, Clientes, Financeiro, Pessoas, Mapa, Relatórios e Portal do Cliente.",
      },
    ],
  },
];

// Id da versão mais recente. Base da marca de "visto" no localStorage.
export const ULTIMA_VERSAO = NOVIDADES[0].versao;

export const ROTULO_TIPO: Record<TipoItem, string> = {
  novo: "Novo",
  melhoria: "Melhoria",
  correcao: "Correção",
};

// Espelha as variantes de status do Badge do projeto (ADR 0008 D3).
export const VARIANTE_TIPO: Record<TipoItem, "success" | "info" | "warning"> = {
  novo: "success",
  melhoria: "info",
  correcao: "warning",
};

/**
 * Fonte única dos planos da landing.
 *
 * Escrito à mão de propósito. A página lia isso do Supabase a cada visita, o
 * que custava um estado de carregamento visível antes de qualquer preço
 * aparecer, para buscar três linhas que mudam uma vez por semestre. Preço e
 * projetos conferidos contra `pilar_subscription_plans` em 26/08 (tabela v3 de
 * `docs/strategy/PRICING.md`); cota de tokens atualizada em 01/09 conforme
 * `tokens_mensais` real da mesma tabela (decisão do motor de tokens,
 * DECISOES.md 31/08 — token é a unidade exposta, não mais "ação de IA").
 *
 * O que separa um plano do outro é **capacidade**, nunca funcionalidade: toda
 * empresa tem a plataforma inteira (ADR 0026). Por isso não existe lista de
 * features por plano, e não pode existir: seria vender de volta o paywall que
 * o ADR removeu.
 */

export interface Plano {
  slug: string;
  nome: string;
  publico: string;
  /** Mensal, em reais. Anual saiu: a v3 registra ciclo anual como N/A. */
  preco: number;
  /** Eixo de cobrança: faixa de projetos ativos. */
  projetos: string;
  /** Cota mensal de tokens de IA (decisão 31/08, DECISOES.md — token é a unidade exposta). */
  tokensMes: string;
  /** O que muda no atendimento, que é serviço e não feature. */
  atendimento: string;
  destaque?: boolean;
}

export const PLANOS: Plano[] = [
  {
    slug: "starter",
    nome: "Essencial",
    publico: "Escritório de 5 a 8 pessoas",
    preco: 490,
    projetos: "Até 15 projetos ativos",
    tokensMes: "500 mil tokens de IA por mês",
    atendimento: "Suporte por e-mail e WhatsApp",
  },
  {
    slug: "pro",
    nome: "Profissional",
    publico: "O mais escolhido, e onde a maioria fica",
    preco: 690,
    projetos: "Até 40 projetos ativos",
    tokensMes: "2 milhões de tokens de IA por mês",
    atendimento: "Migração assistida da sua planilha",
    destaque: true,
  },
  {
    slug: "enterprise",
    nome: "Escala",
    publico: "Operação maior ou multiequipe",
    preco: 1290,
    projetos: "Projetos ativos ilimitados",
    tokensMes: "8 milhões de tokens de IA por mês",
    atendimento: "Implantação acompanhada e canal direto",
  },
];

/** O que todo plano inclui, sem exceção. É o argumento central do pricing. */
export const INCLUSO_EM_TODOS = [
  "Usuários ilimitados, sem cobrar por cabeça",
  "Gestão, Projetos e Obras, a plataforma inteira",
  "Portal do cliente e Pilar Campo",
  "Agentes de IA com aprovação sua",
  "Todos os relatórios e exportações",
  "Atualizações e novos módulos incluídos",
];

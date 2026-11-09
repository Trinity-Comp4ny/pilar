/**
 * Fonte única dos planos da landing.
 *
 * Escrito à mão de propósito. A página lia isso do Supabase a cada visita, o
 * que custava um estado de carregamento visível antes de qualquer preço
 * aparecer, para buscar três linhas que mudam uma vez por semestre. Preço e
 * projetos conferidos contra `pilar_subscription_plans` em 26/08 (tabela v3 de
 * `docs/strategy/PRICING.md`). Preços R$299/499/899 e cota em créditos de IA
 * desde 06/11 (DECISOES.md 2026-11-06): a LP fala em crédito, não em token,
 * na razão fixa de 1 crédito = 5 mil tokens (500k → 100, 2M → 400, 8M → 1.600).
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
  /** Eixos de capacidade, um por módulo (DECISOES.md 2026-11-06): projetos, obras e leads ativos. */
  projetos: string;
  obras: string;
  leads: string;
  /** Cota mensal em créditos de IA (DECISOES.md 2026-11-06: 1 crédito = 5 mil tokens). */
  creditosMes: string;
  /** O que muda no atendimento, que é serviço e não feature. */
  atendimento: string;
  destaque?: boolean;
}

export const PLANOS: Plano[] = [
  {
    slug: "starter",
    nome: "Essencial",
    publico: "Escritório de 5 a 8 pessoas",
    preco: 299,
    projetos: "Até 10 projetos ativos",
    obras: "Até 2 obras ativas",
    leads: "Até 50 leads ativos no funil",
    creditosMes: "100 créditos de IA por mês",
    atendimento: "Suporte por e-mail e WhatsApp",
  },
  {
    slug: "pro",
    nome: "Profissional",
    publico: "O mais escolhido, e onde a maioria fica",
    preco: 499,
    projetos: "Até 30 projetos ativos",
    obras: "Até 5 obras ativas",
    leads: "Até 200 leads ativos no funil",
    creditosMes: "400 créditos de IA por mês",
    atendimento: "Migração assistida da sua planilha",
    destaque: true,
  },
  {
    slug: "enterprise",
    nome: "Escala",
    publico: "Operação maior ou multiequipe",
    preco: 899,
    projetos: "Projetos ativos ilimitados",
    obras: "Até 15 obras ativas",
    leads: "Leads ilimitados no funil",
    creditosMes: "1.600 créditos de IA por mês",
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

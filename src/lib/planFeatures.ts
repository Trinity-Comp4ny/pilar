/**
 * Mapeamento de features por slug de plano.
 *
 * Fonte de verdade para controle de acesso por plano de assinatura.
 * O catálogo visual (includedInPlans por feature) fica em features.ts;
 * este arquivo é o oposto — dado um plano, quais features ele libera.
 *
 * TODO(billing): integrar no usePermissions quando o perfil expor o slug
 * do plano ativo da empresa. Caminho sugerido:
 *   1. usePermissions lê profile.empresas.pilar_subscription (join)
 *   2. Passa planSlug para canDo via AccessContext
 *   3. canDo chama planIncludesFeature antes de isFeatureEnabledForCompany
 */

import type { FeatureKey } from "./features";

// Features disponíveis por slug de plano.
// Ordem importa: planos superiores devem incluir tudo do inferior.
export const PLAN_FEATURES: Record<string, FeatureKey[]> = {
  starter: [
    "dashboard",
    "projetos",
    "clientes",
    "propostas",
    "leads",
    "financeiro",
    "relatorios",
    "mapa",
  ],
  pro: [
    "dashboard",
    "projetos",
    "clientes",
    "propostas",
    "leads",
    "financeiro",
    "relatorios",
    "mapa",
    "pessoas",
    "timesheet",
    "capacidade",
  ],
  enterprise: [
    "dashboard",
    "projetos",
    "clientes",
    "propostas",
    "leads",
    "financeiro",
    "relatorios",
    "mapa",
    "pessoas",
    "timesheet",
    "capacidade",
    "templates",
    "ai_hub",
  ],
};

/** Retorna as features liberadas para um slug de plano.
 *  Cai em 'starter' se o slug não for reconhecido. */
export function getFeaturesForPlan(slug: string): FeatureKey[] {
  return PLAN_FEATURES[slug] ?? PLAN_FEATURES.starter;
}

/** Retorna true se o plano incluir a feature informada. */
export function planIncludesFeature(slug: string, feature: FeatureKey): boolean {
  return getFeaturesForPlan(slug).includes(feature);
}

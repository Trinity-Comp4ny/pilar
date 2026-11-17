// Ponto único para telas de outros módulos abrirem a troca de plano e lerem a
// assinatura, sem importar de `pages/billing` (ADR 0055).
export { ChangePlanDialog } from "@/pages/billing/components/ChangePlanDialog";
export { useMySubscription } from "@/pages/billing/hooks/useMySubscription";

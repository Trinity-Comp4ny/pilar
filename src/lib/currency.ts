/**
 * @deprecated Importe de "@/lib/format" (ADR 0008).
 *
 * Comportamento LEGADO preservado de propósito: mínimo 0 e máximo 2 casas
 * ("R$ 1.234,5"), diferente de formatCurrency({ decimals: 0 }) que arredonda.
 * Cada ponto de uso decide na migração: 2 casas (padrão) ou 0 casas explícito.
 * Remover este arquivo quando não houver mais imports.
 */
export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  });
}

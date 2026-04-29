/**
 * Utilitários para formatação de valores monetários
 */

/**
 * Formata um valor numérico para o formato de moeda brasileira (R$)
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export const removeNonNumeric = (value: string): string => {
  return value.replace(/\D/g, "");
};

export const parseCurrencyString = (value: string): number => {
  if (!value) return 0;
  // Remove R$, espaços e pontos (separadores de milhar)
  const clean = value.replace(/[R$\s.]/g, "");
  // Tudo exceto dígitos e vírgula
  const normalized = clean.replace(/[^\d,]/g, "");
  if (!normalized) return 0;
  if (normalized.includes(",")) {
    const [int, dec = ""] = normalized.split(",");
    return parseFloat(`${int || "0"}.${dec.slice(0, 2).padEnd(2, "0")}`);
  }
  // Sem vírgula: dígitos = centavos (últimos 2 são decimais)
  return (parseInt(normalized) || 0) / 100;
};

// Formata um número (reais) para exibição no campo de texto
export const formatValorToInput = (valor: number): string => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
};

// Formata entrada do usuário em tempo real (máscara de moeda).
// Dígitos sem vírgula = centavos (últimos 2 são decimais).
export const formatCurrencyInput = (value: string): string => {
  if (!value) return "R$ 0,00";

  const digits = removeNonNumeric(value);
  if (!digits) return "R$ 0,00";

  const cents = parseInt(digits) || 0;
  const reais = cents / 100;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(reais);
};

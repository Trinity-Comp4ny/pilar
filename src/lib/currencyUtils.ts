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
  const raw = value.replace(/[^\d.,]/g, "");
  if (!raw) return 0;
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  // O separador que aparece por ÚLTIMO é o decimal. Cobre BR ("1.000,50") e
  // também o formato US colado ("1,000.50"), que antes virava R$ 1,00 (ACH-FIN-01).
  if (lastComma > lastDot) {
    const int = raw.slice(0, lastComma).replace(/\./g, "");
    const dec = raw.slice(lastComma + 1).slice(0, 2);
    return parseFloat(`${int || "0"}.${dec.padEnd(2, "0")}`);
  }
  if (lastDot > lastComma) {
    const int = raw.slice(0, lastDot).replace(/,/g, "");
    const dec = raw.slice(lastDot + 1).slice(0, 2);
    return parseFloat(`${int || "0"}.${dec.padEnd(2, "0")}`);
  }
  // Sem separador: dígitos = centavos (comportamento da máscara de entrada).
  return (parseInt(raw) || 0) / 100;
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

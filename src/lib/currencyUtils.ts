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
  return parseInt(normalized) || 0;
};

// Formata um número (reais) para exibição no campo de texto
export const formatValorToInput = (valor: number): string => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
};

// Formata entrada do usuário em tempo real.
// Trata vírgula como separador decimal; dígitos sem vírgula = reais inteiros.
export const formatCurrencyInput = (value: string): string => {
  if (!value) return "R$ 0,00";

  // Preserva vírgula, remove R$, espaços e pontos (milhar)
  const stripped = value.replace(/[R$\s.]/g, "");
  if (!stripped) return "R$ 0,00";

  if (stripped.includes(",")) {
    const [int, dec = ""] = stripped.split(",");
    const intNum = parseInt(int.replace(/\D/g, "") || "0");
    const decStr = dec.replace(/\D/g, "").slice(0, 2);
    const num = parseFloat(`${intNum}.${decStr.padEnd(2, "0")}`);
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
  }

  // Sem vírgula — dígitos representam reais inteiros
  const digits = stripped.replace(/\D/g, "");
  const num = parseInt(digits) || 0;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
};

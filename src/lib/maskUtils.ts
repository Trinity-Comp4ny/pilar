/**
 * Tools for masks and CPF/CNPJ validation
 */

export const onlyDigits = (v: string): string => v.replace(/\D/g, "");

export const formatCPF = (value: string): string => {
  const d = onlyDigits(value).slice(0, 11);
  if (!d) return "";
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.replace(/(\d{3})(\d+)/, "$1.$2");
  if (d.length <= 9) return d.replace(/(\d{3})(\d{3})(\d+)/, "$1.$2.$3");
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
};

export const formatCNPJ = (value: string): string => {
  const d = onlyDigits(value).slice(0, 14);
  if (!d) return "";
  if (d.length <= 2) return d;
  if (d.length <= 5) return d.replace(/(\d{2})(\d+)/, "$1.$2");
  if (d.length <= 8) return d.replace(/(\d{2})(\d{3})(\d+)/, "$1.$2.$3");
  if (d.length <= 12) return d.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, "$1.$2.$3/$4");
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, "$1.$2.$3/$4-$5");
};

export const formatDocument = (value: string): string => {
  const d = onlyDigits(value);
  return d.length > 11 ? formatCNPJ(d) : formatCPF(d);
};

export const formatPhone = (value: string): string => {
  const d = onlyDigits(value).slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return d;
  if (d.length <= 6) return d.replace(/(\d{2})(\d+)/, "($1) $2");
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d+)/, "($1) $2-$3");
  return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
};

/**
 * Formata agência bancária brasileira
 * Geralmente 4 dígitos, mas alguns bancos usam mais
 */
export const formatAgency = (value: string): string => {
  const d = onlyDigits(value).slice(0, 5); // Máximo 5 dígitos
  if (!d) return "";
  return d;
};

/**
 * Formata conta bancária brasileira
 * Padrões comuns: 12345-6, 123456-7, 12345678-9, etc.
 */
export const formatBankAccount = (value: string): string => {
  const d = onlyDigits(value).slice(0, 10); // Máximo 10 dígitos
  if (!d) return "";

  // Se tem 6 ou mais dígitos, adiciona dígito verificador
  if (d.length >= 6) {
    const accountNumber = d.slice(0, -1);
    const checkDigit = d.slice(-1);
    return `${accountNumber}-${checkDigit}`;
  }

  return d;
};

/**
 * Formata um valor digitado pelo usuário em tempo real
 * Converte números digitados para formato de moeda brasileira com símbolo R$
 */
export const formatCurrencyInput = (value: string): string => {
  if (!value) return "R$ 0,00";

  // Remove todos os caracteres não numéricos
  const numbersOnly = value.replace(/\D/g, "");

  if (numbersOnly === "") return "R$ 0,00";

  // Converte para centavos (divide por 100)
  const cents = parseInt(numbersOnly) || 0;
  const reais = cents / 100;

  // Formata como moeda brasileira com símbolo R$
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(reais);
};

/**
 * Converte uma string formatada (com vírgula decimal e possivelmente R$) para número
 */
export const parseCurrencyString = (value: string): number => {
  if (!value) return 0;

  // Remove o símbolo R$ e espaços
  const cleanValue = value.replace(/[R$\s]/g, "");

  // Remove todos os caracteres exceto dígitos e vírgula
  const numbersOnly = cleanValue.replace(/[^\d,]/g, "");

  // Se houver vírgula, trata como decimal
  if (numbersOnly.includes(",")) {
    const parts = numbersOnly.split(",");
    const integerPart = parts[0] || "0";
    const decimalPart = parts[1] ? parts[1].slice(0, 2) : "00"; // Máximo 2 casas decimais
    return parseFloat(`${integerPart}.${decimalPart}`);
  }

  // Se não houver vírgula, trata como centavos
  const numValue = parseInt(numbersOnly) || 0;
  return numValue / 100;
};

export default {
  onlyDigits,
  formatCPF,
  formatCNPJ,
  formatDocument,
  formatPhone,
  formatCurrencyInput,
  parseCurrencyString,
};

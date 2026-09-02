/**
 * Tools for masks and CPF/CNPJ validation
 */

export const onlyDigits = (v: string | null | undefined): string => (v ?? "").replace(/\D/g, "");

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

export const formatCEP = (value: string): string => {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
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

export const validateEmail = (value: string): boolean => {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

export const validateCPF = (value: string): boolean => {
  const d = onlyDigits(value);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number): number => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(d[i]) * (len + 1 - i);
    const rem = (sum * 10) % 11;
    return rem === 10 || rem === 11 ? 0 : rem;
  };
  return calc(9) === parseInt(d[9]) && calc(10) === parseInt(d[10]);
};

export const validateCNPJ = (value: string): boolean => {
  const d = onlyDigits(value);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number): number => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(d[i]) * weights[i];
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  return calc(12) === parseInt(d[12]) && calc(13) === parseInt(d[13]);
};

export default {
  onlyDigits,
  formatCPF,
  formatCNPJ,
  formatDocument,
  formatPhone,
  validateEmail,
  validateCPF,
  validateCNPJ,
};

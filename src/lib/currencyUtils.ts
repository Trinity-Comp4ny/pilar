/**
 * Utilitários para formatação de valores monetários
 */

/**
 * Formata um valor numérico para o formato de moeda brasileira (R$)
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

/**
 * Remove caracteres não numéricos de uma string, mantendo apenas dígitos
 */
export const removeNonNumeric = (value: string): string => {
  return value.replace(/\D/g, '');
};

/**
 * Converte uma string formatada (com vírgula decimal e possivelmente R$) para número
 */
export const parseCurrencyString = (value: string): number => {
  if (!value) return 0;
  
  // Remove o símbolo R$ e espaços
  const cleanValue = value.replace(/[R$\s]/g, '');
  
  // Remove todos os caracteres exceto dígitos e vírgula
  const numbersOnly = cleanValue.replace(/[^\d,]/g, '');
  
  // Se houver vírgula, trata como decimal
  if (numbersOnly.includes(',')) {
    const parts = numbersOnly.split(',');
    const integerPart = parts[0] || '0';
    const decimalPart = parts[1] ? parts[1].slice(0, 2) : '00'; // Máximo 2 casas decimais
    return parseFloat(`${integerPart}.${decimalPart}`);
  }
  
  // Se não houver vírgula, trata como centavos
  const numValue = parseInt(numbersOnly) || 0;
  return numValue / 100;
};

/**
 * Formata um valor digitado pelo usuário em tempo real
 * Converte números digitados para formato de moeda brasileira com símbolo R$
 */
export const formatCurrencyInput = (value: string): string => {
  if (!value) return 'R$ 0,00';
  
  // Remove todos os caracteres não numéricos
  const numbersOnly = removeNonNumeric(value);
  
  if (numbersOnly === '') return 'R$ 0,00';
  
  // Converte para centavos (divide por 100)
  const cents = parseInt(numbersOnly) || 0;
  const reais = cents / 100;
  
  // Formata como moeda brasileira com símbolo R$
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(reais);
};

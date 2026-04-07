/**
 * Utilitários para tratamento de datas
 * Resolve problemas com conversão de datas e timestamp 0 (31/12/1969)
 */

/**
 * Verifica se uma data é inválida (31/12/1969 ou similar)
 */
export const isInvalidDate = (dateString: string | null | undefined): boolean => {
  if (!dateString) return true;
  
  const date = new Date(dateString);
  // Verifica se o ano é 1969 (timestamp 0) ou se a data é inválida
  return date.getFullYear() === 1969 || isNaN(date.getTime());
};

/**
 * Retorna a data correta para exibição baseada no status
 * - Se status = "Recebido": usa data_recebimento (data real do pagamento)
 * - Se status = "Pendente": usa data_vencimento (data planejada)
 * - Fallbacks inteligentes para diferentes cenários
 */
export const getDisplayDate = (
  dataRecebimento: string | null | undefined, 
  dataVencimento: string | null | undefined,
  status?: string
): string | null => {
  // Se for recebido, prioriza data_recebimento (data real do pagamento)
  if (status === 'Recebido' || status === 'Recebida') {
    if (dataRecebimento && !isInvalidDate(dataRecebimento)) {
      return dataRecebimento;
    }
    // Se não tiver data_recebimento mas for recebido, usa data_vencimento
    if (dataVencimento && !isInvalidDate(dataVencimento)) {
      return dataVencimento;
    }
  }
  
  // Se for pendente, usa data_vencimento (data planejada)
  if (status === 'Pendente') {
    if (dataVencimento && !isInvalidDate(dataVencimento)) {
      return dataVencimento;
    }
    // Se não tiver data_vencimento mas for pendente (automação), usa data_recebimento
    if (dataRecebimento && !isInvalidDate(dataRecebimento)) {
      return dataRecebimento;
    }
  }
  
  // Se não tiver status, usa a lógica original (prioriza data_recebimento)
  if (dataRecebimento && !isInvalidDate(dataRecebimento)) {
    return dataRecebimento;
  }
  
  if (dataVencimento && !isInvalidDate(dataVencimento)) {
    return dataVencimento;
  }
  
  return null;
};

/**
 * Formata data para exibição no formato dd/MM/yyyy
 */
export const formatDateDisplay = (dateString: string | null | undefined): string => {
  const validDate = getDisplayDate(dateString, dateString);
  if (!validDate) return '-';
  
  try {
    // Parse the date string to avoid timezone conversion issues
    // If it's in YYYY-MM-DD format, split and create date in local timezone
    if (validDate.includes('-')) {
      const parts = validDate.split(' ')[0].split('-'); // Take only the date part
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // JavaScript months are 0-indexed
      const day = parseInt(parts[2]);
      
      const date = new Date(year, month, day);
      return date.toLocaleDateString('pt-BR');
    }
    
    // Fallback for other formats
    const date = new Date(validDate);
    return date.toLocaleDateString('pt-BR');
  } catch {
    return '-';
  }
};

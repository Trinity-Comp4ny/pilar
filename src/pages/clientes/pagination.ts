// Utilitários de paginação da lista de clientes. Página é 0-based internamente.

export const CLIENTES_PAGE_SIZE = 20;

export function getTotalPages(total: number, pageSize: number): number {
  if (pageSize <= 0) return 0;
  return Math.ceil(Math.max(total, 0) / pageSize);
}

// Mantém a página dentro do intervalo válido [0, totalPages-1].
// Se não há resultados, volta para a página 0.
export function clampPage(page: number, totalPages: number): number {
  if (totalPages <= 0) return 0;
  return Math.min(Math.max(page, 0), totalPages - 1);
}

// Intervalo 1-based exibido ("Mostrando 21-40 de 57"). Vazio quando total é 0.
export function getPageRange(
  page: number,
  pageSize: number,
  total: number
): { from: number; to: number } {
  if (total <= 0 || pageSize <= 0) return { from: 0, to: 0 };
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);
  return { from, to };
}

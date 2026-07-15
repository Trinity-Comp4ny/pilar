/**
 * Contrato de dados para listas/tabelas.
 *
 * Força quem renderiza uma lista a carregar SEMPRE os três estados:
 * carregando, erro e dados. Assim uma query que falha não é engolida
 * (o erro chega no componente e é exibido, em vez de virar lista vazia).
 *
 * Uso típico com react-query:
 *   const q = useFaturas(id);
 *   const data: DataSourceResult<Fatura> = {
 *     rows: q.data ?? [],
 *     isPending: q.isLoading,
 *     error: q.error,
 *   };
 */
export interface DataSourceResult<Row> {
  rows: Row[];
  isPending?: boolean;
  error?: Error | null;
}

/** Adapta o retorno de um useQuery do react-query para o contrato acima. */
export function toDataSourceResult<Row>(query: {
  data?: Row[];
  isLoading?: boolean;
  isPending?: boolean;
  error?: unknown;
}): DataSourceResult<Row> {
  const error =
    query.error == null
      ? null
      : query.error instanceof Error
        ? query.error
        : new Error(String((query.error as { message?: string })?.message ?? query.error));

  return {
    rows: query.data ?? [],
    isPending: query.isPending ?? query.isLoading ?? false,
    error,
  };
}

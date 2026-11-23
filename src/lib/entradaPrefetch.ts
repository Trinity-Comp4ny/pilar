import type { QueryClient } from "@tanstack/react-query";

/** Quem está entrando: chaves de cache com dado sob RLS variam por empresa e usuário. */
export interface ContextoEntrada {
  empresaId: string;
  usuarioId: string;
}

const STALE = 5 * 60 * 1000;

/**
 * Dados que a primeira tela precisa, por rota. O véu de entrada fica na tela enquanto
 * eles chegam, para o app abrir já com tudo por trás (sem esqueleto depois do véu).
 * Cada rota nova entra aqui com os MESMOS queryKey/queryFn do hook que a tela usa.
 */
const ROTAS: Array<{ prefixo: string; buscar: (qc: QueryClient, ctx: ContextoEntrada) => Array<Promise<unknown>> }> = [
  {
    prefixo: "/projetos",
    // Import dinâmico: o código da tela não entra no bundle inicial (orçamento de bundle).
    buscar: (qc) => [
      import("@/pages/projetos/hooks/useProjetosData").then(({ fetchProjetos }) =>
        qc.prefetchQuery({ queryKey: ["projetos"], queryFn: fetchProjetos, staleTime: STALE })
      ),
      import("@/pages/projetos/hooks/useProjetoEtapas").then(({ fetchEtapasProjeto, KEY_ETAPAS_PROJETO }) =>
        qc.prefetchQuery({ queryKey: KEY_ETAPAS_PROJETO, queryFn: fetchEtapasProjeto, staleTime: STALE })
      ),
    ],
  },
  {
    prefixo: "/clientes",
    // Mesma chave e parâmetros iniciais da tela (página 0, ordem por nome, sem filtro).
    buscar: (qc) => [
      Promise.all([import("@/hooks/useClientes"), import("@/pages/clientes/pagination")]).then(
        ([{ fetchClientesPagina, chaveClientesLista }, { CLIENTES_PAGE_SIZE }]) => {
          const params = {
            page: 0,
            pageSize: CLIENTES_PAGE_SIZE,
            search: "",
            origem: "all",
            tipoPessoa: "all",
            portal: "all",
            projeto: "all",
            sortField: "nome",
            sortDir: "asc",
          } as const;
          return qc.prefetchQuery({
            queryKey: chaveClientesLista(params),
            queryFn: () => fetchClientesPagina(params),
            staleTime: STALE,
          });
        }
      ),
    ],
  },
  {
    prefixo: "/obras",
    buscar: (qc) => [
      import("@/pages/obras/hooks/useObras").then(({ fetchObras, KEY_OBRAS_LISTA }) =>
        qc.prefetchQuery({ queryKey: KEY_OBRAS_LISTA, queryFn: fetchObras, staleTime: STALE })
      ),
    ],
  },
  {
    prefixo: "/inicio",
    // Mesma chave de usePainelGestao (empresa e usuário).
    buscar: (qc, { empresaId, usuarioId }) => [
      import("@/pages/inicio/hooks/usePainelGestao").then(({ fetchPainelGestao }) =>
        qc.prefetchQuery({
          queryKey: ["painel-gestao", empresaId, usuarioId],
          queryFn: fetchPainelGestao,
          staleTime: STALE,
        })
      ),
    ],
  },
];

export function prefetchDaRota(qc: QueryClient, pathname: string, ctx: ContextoEntrada): Array<Promise<unknown>> {
  const rota = ROTAS.find((r) => pathname === r.prefixo || pathname.startsWith(`${r.prefixo}/`));
  return rota ? rota.buscar(qc, ctx) : [];
}

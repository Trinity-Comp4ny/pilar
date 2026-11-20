import type { QueryClient } from "@tanstack/react-query";

const STALE = 5 * 60 * 1000;

/**
 * Dados que a primeira tela precisa, por rota. O véu de entrada fica na tela enquanto
 * eles chegam, para o app abrir já com tudo por trás (sem esqueleto depois do véu).
 * Cada rota nova entra aqui com os MESMOS queryKey/queryFn do hook que a tela usa.
 */
const ROTAS: Array<{ prefixo: string; buscar: (qc: QueryClient) => Array<Promise<unknown>> }> = [
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
];

export function prefetchDaRota(qc: QueryClient, pathname: string): Array<Promise<unknown>> {
  const rota = ROTAS.find((r) => pathname === r.prefixo || pathname.startsWith(`${r.prefixo}/`));
  return rota ? rota.buscar(qc) : [];
}

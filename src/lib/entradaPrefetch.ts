import type { QueryClient } from "@tanstack/react-query";
import { fetchProjetos } from "@/pages/projetos/hooks/useProjetosData";
import { fetchEtapasProjeto, KEY_ETAPAS_PROJETO } from "@/pages/projetos/hooks/useProjetoEtapas";

const STALE = 5 * 60 * 1000;

/**
 * Dados que a primeira tela precisa, por rota. O véu de entrada fica na tela enquanto
 * eles chegam, para o app abrir já com tudo por trás (sem esqueleto depois do véu).
 * Cada rota nova entra aqui com os MESMOS queryKey/queryFn do hook que a tela usa.
 */
const ROTAS: Array<{ prefixo: string; buscar: (qc: QueryClient) => Array<Promise<unknown>> }> = [
  {
    prefixo: "/projetos",
    buscar: (qc) => [
      qc.prefetchQuery({ queryKey: ["projetos"], queryFn: fetchProjetos, staleTime: STALE }),
      qc.prefetchQuery({ queryKey: KEY_ETAPAS_PROJETO, queryFn: fetchEtapasProjeto, staleTime: STALE }),
    ],
  },
];

export function prefetchDaRota(qc: QueryClient, pathname: string): Array<Promise<unknown>> {
  const rota = ROTAS.find((r) => pathname === r.prefixo || pathname.startsWith(`${r.prefixo}/`));
  return rota ? rota.buscar(qc) : [];
}

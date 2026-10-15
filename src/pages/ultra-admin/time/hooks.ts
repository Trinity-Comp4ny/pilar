import { useQuery } from "@tanstack/react-query";
import { buscarReceita, buscarSaude, listarAcoesPendentes, listarAgentes, listarUltimasExecucoes } from "./api";

/** Chaves do Time: dentro de ["ultra-admin"], então o invalidate geral do portal pega tudo. */
const TIME_KEYS = {
  agentes: ["ultra-admin", "time", "agentes"] as const,
  execucoes: ["ultra-admin", "time", "execucoes"] as const,
  pendentes: ["ultra-admin", "time", "pendentes"] as const,
  receita: (dias: number) => ["ultra-admin", "time", "receita", dias] as const,
  saude: ["ultra-admin", "time", "saude"] as const,
};

export function useAgentes() {
  return useQuery({ queryKey: TIME_KEYS.agentes, queryFn: listarAgentes, staleTime: 5 * 60_000 });
}

export function useUltimasExecucoes() {
  return useQuery({ queryKey: TIME_KEYS.execucoes, queryFn: listarUltimasExecucoes, staleTime: 60_000 });
}

export function useAcoesPendentes() {
  return useQuery({ queryKey: TIME_KEYS.pendentes, queryFn: listarAcoesPendentes, staleTime: 60_000 });
}

export function useReceita(dias: number) {
  return useQuery({ queryKey: TIME_KEYS.receita(dias), queryFn: () => buscarReceita(dias), staleTime: 60_000 });
}

export function useSaudeEmpresas() {
  return useQuery({ queryKey: TIME_KEYS.saude, queryFn: buscarSaude, staleTime: 60_000 });
}

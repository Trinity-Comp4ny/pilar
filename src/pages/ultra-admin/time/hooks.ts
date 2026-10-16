import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/safeError";
import {
  buscarReceita,
  buscarSaude,
  decidirAcao,
  definirAgenteAtivo,
  listarAcoesPendentes,
  listarAgentes,
  listarEfeitosDoAgente,
  listarExecucoesDoAgente,
  listarUltimasExecucoes,
  rodarAgente,
} from "./api";

/** Chaves do Time: dentro de ["ultra-admin"], então o invalidate geral do portal pega tudo. */
const TIME_KEYS = {
  raiz: ["ultra-admin", "time"] as const,
  agentes: ["ultra-admin", "time", "agentes"] as const,
  execucoes: ["ultra-admin", "time", "execucoes"] as const,
  execucoesDoAgente: (id: string) => ["ultra-admin", "time", "execucoes", id] as const,
  efeitos: (id: string) => ["ultra-admin", "time", "efeitos", id] as const,
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

export function useExecucoesDoAgente(agenteId: string) {
  return useQuery({
    queryKey: TIME_KEYS.execucoesDoAgente(agenteId),
    queryFn: () => listarExecucoesDoAgente(agenteId),
    staleTime: 60_000,
  });
}

export function useEfeitosDoAgente(agenteId: string) {
  return useQuery({
    queryKey: TIME_KEYS.efeitos(agenteId),
    queryFn: () => listarEfeitosDoAgente(agenteId),
    staleTime: 5 * 60_000,
  });
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

/** Marcar como enviada ou descartar uma ação de agente. */
export function useDecidirAcao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: decidirAcao,
    onSuccess: (_d, v) => {
      toast.success(v.decisao === "enviada" ? "Marcada como enviada" : "Ação descartada");
      void qc.invalidateQueries({ queryKey: TIME_KEYS.pendentes });
    },
    onError: (e) => toast.error("Não deu para registrar a decisão", { description: getSafeErrorMessage(e) }),
  });
}

export function useDefinirAgenteAtivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { agenteId: string; ativo: boolean }) => definirAgenteAtivo(v.agenteId, v.ativo),
    onSuccess: (_d, v) => {
      toast.success(v.ativo ? "Agente retomado" : "Agente pausado", {
        description: v.ativo
          ? "Volta a rodar no próximo horário."
          : "O horário automático fica parado até você retomar.",
      });
      void qc.invalidateQueries({ queryKey: TIME_KEYS.agentes });
    },
    onError: (e) => toast.error("Não deu para mudar o agente", { description: getSafeErrorMessage(e) }),
  });
}

export function useRodarAgente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: rodarAgente,
    onSuccess: () => {
      toast.success("Agente rodou", { description: "Briefing e ações atualizados." });
      void qc.invalidateQueries({ queryKey: TIME_KEYS.raiz });
    },
    onError: (e) =>
      toast.error("O agente não terminou", {
        description: `${getSafeErrorMessage(e)} Veja a execução na ficha e tente de novo.`,
      }),
  });
}

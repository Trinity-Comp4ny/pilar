import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type PendenciaSeveridade = "critical" | "high" | "medium" | "low";
export type PendenciaArea = "financeiro" | "prazos" | "orcamento" | "obra" | "planejamento" | "comercial";

/** Pendência de acompanhamento (SPEC 146). `dados` carrega os fatos da regra; o front só formata. */
export type Pendencia = Omit<Tables<"agente_pendencias">, "dados" | "severidade" | "area"> & {
  dados: Record<string, unknown>;
  severidade: PendenciaSeveridade;
  area: PendenciaArea;
};

export type CobrancaRascunho = Pick<
  Tables<"cobrancas">,
  "id" | "etapa" | "status" | "destinatario_email" | "assunto" | "abertura"
> & { fatos: Record<string, unknown> };

const pendenciasKey = ["agente_pendencias"] as const;

/**
 * Fila de pendências da empresa. Abrir a aba atualiza a fila (a função pula se rodou há menos de
 * 5 minutos); depois lê só o que está aberto. Quem não vê dinheiro recebe só as áreas que a RLS libera.
 */
export function useAgentePendencias() {
  return useQuery({
    queryKey: pendenciasKey,
    queryFn: async (): Promise<Pendencia[]> => {
      const { error: erroAtualizar } = await supabase.rpc("agente_pendencias_atualizar");
      if (erroAtualizar) throw erroAtualizar;

      const { data, error } = await supabase
        .from("agente_pendencias")
        .select("*")
        .eq("status", "aberta")
        .order("primeira_deteccao", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Pendencia[];
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useAdiarPendencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dias }: { id: string; dias: number }) => {
      const { error } = await supabase.rpc("agente_pendencia_adiar", { p_id: id, p_dias: dias });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: pendenciasKey }),
  });
}

export function useDispensarPendencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("agente_pendencia_dispensar", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: pendenciasKey }),
  });
}

/** Rascunho de cobrança preparado pelo agente (SPEC 148), para o usuário revisar. */
export function useCobranca(id: string | null) {
  return useQuery({
    queryKey: ["cobrancas", id],
    enabled: !!id,
    queryFn: async (): Promise<CobrancaRascunho> => {
      const { data, error } = await supabase
        .from("cobrancas")
        .select("id, etapa, status, destinatario_email, assunto, abertura, fatos")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as unknown as CobrancaRascunho;
    },
  });
}

/** Aprovar e enviar: único caminho que manda o e-mail (função cobranca-enviar). */
export function useEnviarCobranca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cobrancaId, abertura }: { cobrancaId: string; abertura?: string }) => {
      const { data, error } = await supabase.functions.invoke("cobranca-enviar", {
        body: { cobranca_id: cobrancaId, ...(abertura ? { abertura } : {}) },
      });
      if (error) {
        const corpo = error.context ? await error.context.json?.().catch(() => null) : null;
        throw new Error(corpo?.error || error.message || "Erro desconhecido");
      }
      if (data?.error) throw new Error(data.error);
      return data as { email: string; etapa: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: pendenciasKey }),
  });
}

/** Recusar a etapa ou registrar que já cobrou por fora. */
export function useDecidirCobranca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cobrancaId, status }: { cobrancaId: string; status: "recusada" | "externa" }) => {
      const { error } = await supabase.rpc("cobranca_decidir", { p_id: cobrancaId, p_status: status });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: pendenciasKey }),
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export interface TimesheetLancamento {
  id: string;
  empresa_id: string;
  user_id: string;
  projeto_id: string;
  fase_id: string | null;
  descricao: string;
  horas: number;
  data: string;
  status: "pendente" | "aprovado" | "rejeitado";
  aprovado_por: string | null;
  created_at: string;
  updated_at: string;
  // joins
  projeto_nome?: string;
  fase_nome?: string;
  user_nome?: string;
}

export interface TimesheetFilters {
  projetoId?: string;
  userId?: string;
  dataInicio?: string;
  dataFim?: string;
  status?: string;
}

export interface LancarHorasPayload {
  projeto_id: string;
  fase_id?: string | null;
  descricao: string;
  horas: number;
  data: string;
}

function buildQueryKey(filters: TimesheetFilters) {
  return ["timesheet-lancamentos", filters];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function useTimesheetLancamentos(filters: TimesheetFilters = {}) {
  return useQuery({
    queryKey: buildQueryKey(filters),
    queryFn: async () => {
      let query = db
        .from("timesheet_lancamentos")
        .select(
          `
          *,
          projetos (nome),
          projeto_orcamento_fases (disciplina),
          profiles!timesheet_lancamentos_user_id_fkey (nome, sobrenome)
        `
        )
        .order("data", { ascending: false })
        .order("created_at", { ascending: false });

      if (filters.projetoId) query = query.eq("projeto_id", filters.projetoId);
      if (filters.userId) query = query.eq("user_id", filters.userId);
      if (filters.status) query = query.eq("status", filters.status);
      if (filters.dataInicio) query = query.gte("data", filters.dataInicio);
      if (filters.dataFim) query = query.lte("data", filters.dataFim);

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((row: Record<string, unknown>) => {
        const r = row;
        const projetos = r.projetos as { nome: string } | null;
        const fases = r.projeto_orcamento_fases as { disciplina: string } | null;
        const profile = r.profiles as { nome: string; sobrenome?: string } | null;

        return {
          id: r.id,
          empresa_id: r.empresa_id,
          user_id: r.user_id,
          projeto_id: r.projeto_id,
          fase_id: r.fase_id ?? null,
          descricao: r.descricao,
          horas: Number(r.horas),
          data: r.data,
          status: r.status,
          aprovado_por: r.aprovado_por ?? null,
          created_at: r.created_at,
          updated_at: r.updated_at,
          projeto_nome: projetos?.nome ?? "—",
          fase_nome: fases?.disciplina ?? null,
          user_nome: profile
            ? [profile.nome, profile.sobrenome].filter(Boolean).join(" ")
            : "—",
        } as TimesheetLancamento;
      });
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useLancarHoras() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (payload: LancarHorasPayload) => {
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");

      const { error } = await db.from("timesheet_lancamentos").insert({
        empresa_id: empresaId as string,
        user_id: user!.id,
        projeto_id: payload.projeto_id,
        fase_id: payload.fase_id ?? null,
        descricao: payload.descricao,
        horas: payload.horas,
        data: payload.data,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheet-lancamentos"] });
      toast.success("Horas lançadas com sucesso");
    },
    onError: (error: unknown) => {
      const err = error as { message?: string };
      toast.error("Erro ao lançar horas", { description: err.message });
    },
  });
}

export function useAprovarHoras() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from("timesheet_lancamentos")
        .update({ status: "aprovado", aprovado_por: user!.id })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheet-lancamentos"] });
      toast.success("Lançamento aprovado");
    },
    onError: (error: unknown) => {
      const err = error as { message?: string };
      toast.error("Erro ao aprovar", { description: err.message });
    },
  });
}

// Aprova em lote todos os lançamentos pendentes informados.
export function useAprovarHorasLote() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await db
        .from("timesheet_lancamentos")
        .update({ status: "aprovado", aprovado_por: user!.id })
        .in("id", ids);

      if (error) throw error;
    },
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ["timesheet-lancamentos"] });
      toast.success(`${ids.length} lançamento(s) aprovado(s)`);
    },
    onError: (error: unknown) => {
      const err = error as { message?: string };
      toast.error("Erro ao aprovar", { description: err.message });
    },
  });
}

export function useRejeitarHoras() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from("timesheet_lancamentos")
        .update({ status: "rejeitado", aprovado_por: user!.id })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheet-lancamentos"] });
      toast.success("Lançamento rejeitado");
    },
    onError: (error: unknown) => {
      const err = error as { message?: string };
      toast.error("Erro ao rejeitar", { description: err.message });
    },
  });
}

// Reabre (desfaz aprovação/rejeição) devolvendo o lançamento a pendente.
export function useReabrirHoras() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from("timesheet_lancamentos")
        .update({ status: "pendente", aprovado_por: null })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheet-lancamentos"] });
      toast.success("Lançamento reaberto");
    },
    onError: (error: unknown) => {
      const err = error as { message?: string };
      toast.error("Erro ao reabrir", { description: err.message });
    },
  });
}

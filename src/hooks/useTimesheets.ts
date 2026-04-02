import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TimesheetEntry {
  id: string;
  empresa_id: string;
  pessoa_id: string;
  projeto_id: string;
  disciplina: string;
  data: string;
  horas: number;
  descricao: string | null;
  status: "pendente" | "aprovado" | "rejeitado";
  aprovado_por: string | null;
  aprovado_em: string | null;
  created_at: string;
}

export interface TimesheetInsert {
  pessoa_id: string;
  projeto_id: string;
  disciplina: string;
  data: string;
  horas: number;
  descricao?: string;
}

export interface TimesheetWithDetails extends TimesheetEntry {
  pessoa_nome?: string;
  projeto_nome?: string;
  projeto_codigo?: string;
}

/**
 * Busca timesheets de uma pessoa numa semana específica
 */
export const useTimesheetsByWeek = (pessoaId: string | undefined, weekStart: string, weekEnd: string) => {
  return useQuery({
    queryKey: ["timesheets", pessoaId, weekStart, weekEnd],
    queryFn: async () => {
      if (!pessoaId) return [];

      const { data, error } = await supabase
        .from("timesheets")
        .select("*")
        .eq("pessoa_id", pessoaId)
        .gte("data", weekStart)
        .lte("data", weekEnd)
        .is("deleted_at", null)
        .order("data", { ascending: true });

      if (error) throw error;
      return (data || []) as TimesheetEntry[];
    },
    enabled: !!pessoaId && !!weekStart,
    staleTime: 1000 * 60 * 2,
  });
};

/**
 * Busca projetos + disciplinas atribuídos a uma pessoa
 */
export const useProjetosAtribuidos = (pessoaId: string | undefined) => {
  return useQuery({
    queryKey: ["projetos-atribuidos", pessoaId],
    queryFn: async () => {
      if (!pessoaId) return [];

      // Busca projetos ativos que tenham esta pessoa em alguma disciplina
      const { data: projetos, error } = await supabase
        .from("projetos")
        .select("id, codigo_projeto, nome, disciplinas, status")
        .is("deleted_at", null)
        .in("status", ["Planejamento", "Em andamento"]);

      if (error) throw error;

      // Filtra projetos onde a pessoa é responsável por alguma disciplina
      const projetosAtribuidos = (projetos || [])
        .map((p: any) => {
          const disciplinas = (p.disciplinas || []) as Array<{
            disciplina: string;
            responsavel_id: string;
            responsavel_nome: string;
          }>;
          const minhasDisciplinas = disciplinas.filter(
            (d) => d.responsavel_id === pessoaId
          );
          if (minhasDisciplinas.length === 0) return null;
          return {
            id: p.id,
            codigo_projeto: p.codigo_projeto,
            nome: p.nome,
            disciplinas: minhasDisciplinas.map((d) => d.disciplina),
          };
        })
        .filter(Boolean);

      return projetosAtribuidos as Array<{
        id: string;
        codigo_projeto: string;
        nome: string;
        disciplinas: string[];
      }>;
    },
    enabled: !!pessoaId,
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Busca a pessoa_id vinculada ao usuário atual
 */
export const usePessoaAtual = () => {
  return useQuery({
    queryKey: ["pessoa-atual"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome")
        .eq("profile_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();

      if (error) throw error;
      return data as { id: string; nome: string } | null;
    },
    staleTime: 1000 * 60 * 10,
  });
};

/**
 * Upsert de timesheet (cria ou atualiza pela unique constraint)
 */
export const useUpsertTimesheet = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: TimesheetInsert) => {
      // Tenta buscar entry existente
      const { data: existing } = await supabase
        .from("timesheets")
        .select("id, status")
        .eq("pessoa_id", entry.pessoa_id)
        .eq("projeto_id", entry.projeto_id)
        .eq("disciplina", entry.disciplina)
        .eq("data", entry.data)
        .is("deleted_at", null)
        .maybeSingle();

      if (existing) {
        // Só atualiza se ainda estiver pendente
        if (existing.status !== "pendente") {
          throw new Error("Não é possível editar um timesheet já aprovado/rejeitado");
        }

        if (entry.horas <= 0) {
          // Remove se zerou as horas
          const { error } = await supabase
            .from("timesheets")
            .delete()
            .eq("id", existing.id);
          if (error) throw error;
          return null;
        }

        const { data, error } = await supabase
          .from("timesheets")
          .update({ horas: entry.horas, descricao: entry.descricao })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        if (entry.horas <= 0) return null;

        const { data, error } = await supabase
          .from("timesheets")
          .insert(entry)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
    },
  });
};

/**
 * Busca todos os timesheets pendentes da empresa (para aprovação)
 */
export const useTimesheetsPendentes = () => {
  return useQuery({
    queryKey: ["timesheets-pendentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timesheets")
        .select("*")
        .eq("status", "pendente")
        .is("deleted_at", null)
        .order("data", { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) return [];

      // Busca nomes das pessoas e projetos
      const pessoaIds = [...new Set(data.map((t: any) => t.pessoa_id))];
      const projetoIds = [...new Set(data.map((t: any) => t.projeto_id))];

      const [pessoasRes, projetosRes] = await Promise.all([
        supabase.from("pessoas").select("id, nome").in("id", pessoaIds),
        supabase.from("projetos").select("id, nome, codigo_projeto").in("id", projetoIds),
      ]);

      const pessoasMap = new Map(
        (pessoasRes.data || []).map((p: any) => [p.id, p.nome])
      );
      const projetosMap = new Map(
        (projetosRes.data || []).map((p: any) => [p.id, { nome: p.nome, codigo: p.codigo_projeto }])
      );

      return data.map((t: any) => ({
        ...t,
        pessoa_nome: pessoasMap.get(t.pessoa_id) || "—",
        projeto_nome: projetosMap.get(t.projeto_id)?.nome || "—",
        projeto_codigo: projetosMap.get(t.projeto_id)?.codigo || "—",
      })) as TimesheetWithDetails[];
    },
    staleTime: 1000 * 60 * 2,
  });
};

/**
 * Aprovar ou rejeitar timesheet
 */
export const useAprovarTimesheet = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "aprovado" | "rejeitado" }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("timesheets")
        .update({
          status,
          aprovado_por: user?.id,
          aprovado_em: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["timesheets-pendentes"] });
    },
  });
};

/**
 * Busca todas as pessoas da empresa (para admin escolher de quem ver o timesheet)
 */
export const usePessoasEmpresa = () => {
  return useQuery({
    queryKey: ["pessoas-empresa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome, cargo")
        .is("deleted_at", null)
        .order("nome");

      if (error) throw error;
      return data as Array<{ id: string; nome: string; cargo: string | null }>;
    },
    staleTime: 1000 * 60 * 5,
  });
};

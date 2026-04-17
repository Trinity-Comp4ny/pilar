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
        .select(
          "id, empresa_id, pessoa_id, projeto_id, disciplina, data, horas, descricao, status, aprovado_por, aprovado_em, created_at"
        )
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

      // Query disciplinas where this person is a responsavel, joining project info
      const { data, error } = await supabase
        .from("projeto_disciplina_responsaveis")
        .select(
          `
          pessoa_id,
          projeto_disciplinas (
            nome,
            projeto_id,
            projetos (
              id, codigo_projeto, nome, status, deleted_at
            )
          )
        `
        )
        .eq("pessoa_id", pessoaId);

      if (error) throw error;

      // Group by project
      const projetoMap = new Map<string, { id: string; codigo_projeto: string; nome: string; disciplinas: string[] }>();

      for (const row of data || []) {
        const disc = row.projeto_disciplinas as unknown as {
          nome: string;
          projeto_id: string;
          projetos: { id: string; codigo_projeto: string; nome: string; status: string; deleted_at: string | null };
        };
        if (!disc?.projetos) continue;
        const p = disc.projetos;
        if (p.deleted_at) continue;
        if (!["Planejamento", "Em andamento"].includes(p.status)) continue;

        if (!projetoMap.has(p.id)) {
          projetoMap.set(p.id, {
            id: p.id,
            codigo_projeto: p.codigo_projeto,
            nome: p.nome,
            disciplinas: [],
          });
        }
        projetoMap.get(p.id)!.disciplinas.push(disc.nome);
      }

      return Array.from(projetoMap.values());
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
          const { error } = await supabase.from("timesheets").delete().eq("id", existing.id);
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

        const { data, error } = await supabase.from("timesheets").insert(entry).select().single();
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
        .select("id, pessoa_id, projeto_id, disciplina, data, horas, descricao, status, created_at")
        .eq("status", "pendente")
        .is("deleted_at", null)
        .order("data", { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) return [];

      // Busca nomes das pessoas e projetos
      const pessoaIds = [...new Set(data.map((t) => t.pessoa_id))];
      const projetoIds = [...new Set(data.map((t) => t.projeto_id))];

      const [pessoasRes, projetosRes] = await Promise.all([
        supabase.from("pessoas").select("id, nome").in("id", pessoaIds),
        supabase.from("projetos").select("id, nome, codigo_projeto").in("id", projetoIds),
      ]);

      const pessoasMap = new Map<string, string>((pessoasRes.data || []).map((p) => [p.id, p.nome]));
      const projetosMap = new Map<string, { nome: string; codigo: string | null }>(
        (projetosRes.data || []).map((p) => [p.id, { nome: p.nome, codigo: p.codigo_projeto }])
      );

      return data.map((t) => ({
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
      const {
        data: { user },
      } = await supabase.auth.getUser();

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
 * Busca horas orçadas e consumidas por projeto/disciplina (para feedback visual no timesheet)
 */
export const useHorasOrcadasPorProjeto = (projetoIds: string[]) => {
  return useQuery({
    queryKey: ["horas-orcadas", projetoIds],
    queryFn: async () => {
      if (projetoIds.length === 0) return new Map<string, { orcadas: number; consumidas: number }>();

      // Buscar horas orçadas de projeto_orcamento_fases
      const { data: orcamento, error: orcError } = await supabase
        .from("projeto_orcamento_fases")
        .select("projeto_id, disciplina, horas_estimadas")
        .in("projeto_id", projetoIds)
        .is("deleted_at", null);

      if (orcError) throw orcError;

      // Buscar total de horas consumidas (aprovadas + pendentes) por projeto/disciplina
      const { data: consumidas, error: consError } = await supabase
        .from("timesheets")
        .select("projeto_id, disciplina, horas")
        .in("projeto_id", projetoIds)
        .in("status", ["pendente", "aprovado"])
        .is("deleted_at", null);

      if (consError) throw consError;

      const map = new Map<string, { orcadas: number; consumidas: number }>();

      for (const row of orcamento || []) {
        const key = `${row.projeto_id}::${row.disciplina}`;
        map.set(key, { orcadas: Number(row.horas_estimadas) || 0, consumidas: 0 });
      }

      for (const row of consumidas || []) {
        const key = `${row.projeto_id}::${row.disciplina}`;
        const existing = map.get(key) || { orcadas: 0, consumidas: 0 };
        existing.consumidas += Number(row.horas) || 0;
        map.set(key, existing);
      }

      return map;
    },
    enabled: projetoIds.length > 0,
    staleTime: 1000 * 60 * 3,
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

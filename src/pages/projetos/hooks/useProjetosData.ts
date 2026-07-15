import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PROJECT_PRIORITY, type ProjectPriority } from "@/constants";
import { type Projeto, type ProjetoDisciplinaDB, dbDisciplinaToLegacy } from "@/types/projetos";
import { useTemplates } from "@/hooks/useTemplates";
import { useFluxosDisciplinas } from "@/hooks/useFluxosDisciplinas";
import { useDashboardRentabilidade } from "@/hooks/useRentabilidade";

// Todas as queries de dados da página Projetos: usuário atual, projetos (com
// disciplinas e responsáveis), clientes, pessoas, disciplinas, além de templates,
// fluxos e o mapa de margem bruta por projeto. Mantém as mesmas query keys e a
// mesma transformação de dados da página original.
export function useProjetosData() {
  const { data: templatesData = [] } = useTemplates();
  const { data: fluxosData = [] } = useFluxosDisciplinas();
  const { data: rentabilidadeData } = useDashboardRentabilidade();

  const rentabilidadeMap = useMemo<Record<string, number>>(() => {
    if (!rentabilidadeData?.projetos) return {};
    return Object.fromEntries(
      rentabilidadeData.projetos.map((p) => [p.projeto_id, p.margem_bruta_pct])
    );
  }, [rentabilidadeData]);

  const { data: currentUser = null } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      return {
        name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuário",
        email: user.email || "",
      };
    },
  });

  const {
    data: projetos = [],
    isLoading: loadingProjetos,
    isError: projetosError,
    refetch: refetchProjetos,
  } = useQuery({
    queryKey: ["projetos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select(
          `
          *,
          clientes (nome, email),
          projeto_disciplinas (
            id, nome, status, data_inicio, data_fim, data_fim_real,
            prioridade, justificativa_atraso, horas_estimadas, custo_hora,
            observacoes, created_at, updated_at, projeto_id,
            projeto_disciplina_responsaveis (
              pessoa_id,
              pessoas ( id, nome )
            )
          )
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((p) => {
        const proj = p as Record<string, unknown> & {
          clientes?: { nome: string; email: string };
          projeto_disciplinas?: Array<Record<string, unknown>>;
        };
        const rawDiscs = (proj.projeto_disciplinas || []) as Array<{
          id: string;
          projeto_id: string;
          nome: string;
          status: string;
          data_inicio: string | null;
          data_fim: string | null;
          data_fim_real: string | null;
          observacoes: string | null;
          prioridade: string | null;
          justificativa_atraso: string | null;
          horas_estimadas: number;
          custo_hora: number;
          created_at: string;
          updated_at: string;
          projeto_disciplina_responsaveis: Array<{
            pessoa_id: string;
            pessoas: { id: string; nome: string };
          }>;
        }>;

        const dbDiscs: ProjetoDisciplinaDB[] = rawDiscs.map((d) => ({
          id: d.id,
          projeto_id: d.projeto_id,
          nome: d.nome,
          status: d.status,
          data_inicio: d.data_inicio,
          data_fim: d.data_fim,
          data_fim_real: d.data_fim_real,
          observacoes: d.observacoes,
          prioridade: d.prioridade,
          justificativa_atraso: d.justificativa_atraso,
          horas_estimadas: d.horas_estimadas,
          custo_hora: d.custo_hora,
          created_at: d.created_at,
          updated_at: d.updated_at,
          responsaveis:
            d.projeto_disciplina_responsaveis?.map((r) => ({
              id: r.pessoas.id,
              nome: r.pessoas.nome,
            })) || [],
        }));

        return {
          id: proj.id as string,
          codigo_projeto: proj.codigo_projeto as string,
          nome: proj.nome as string,
          cliente_id: proj.cliente_id as string,
          cliente_nome: proj.clientes?.nome,
          cliente_email: proj.clientes?.email,
          localizacao: proj.localizacao as string | undefined,
          parcelas: proj.parcelas as string | undefined,
          area_m2: proj.area_m2 as number | undefined,
          data_inicio: proj.data_inicio as string,
          data_previsao: proj.data_previsao as string,
          data_final: proj.data_final as string | undefined,
          status: proj.status as Projeto["status"],
          prioridade: (proj.prioridade as ProjectPriority) || PROJECT_PRIORITY.MEDIA,
          valor_contrato: proj.valor_contrato as number,
          observacao: proj.observacao as string,
          disciplinas: dbDiscs.map(dbDisciplinaToLegacy),
        };
      }) as Projeto[];
    },
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id, nome").order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: pessoas = [] } = useQuery({
    queryKey: ["pessoas-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pessoas").select("id, nome").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: disciplinas = [] } = useQuery({
    queryKey: ["disciplinas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("disciplinas").select("id, nome").order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  return {
    templatesData,
    fluxosData,
    rentabilidadeMap,
    currentUser,
    projetos,
    loadingProjetos,
    projetosError,
    refetchProjetos,
    clientes,
    pessoas,
    disciplinas,
  };
}

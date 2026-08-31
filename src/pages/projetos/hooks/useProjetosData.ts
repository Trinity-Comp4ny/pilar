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
    return Object.fromEntries(rentabilidadeData.projetos.map((p) => [p.projeto_id, p.margem_bruta_pct]));
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
      // projetos_safe (view) mascara valor_contrato/custo_indireto_pct sem
      // financeiro. Views não embedam relação via PostgREST (sem FK visível),
      // então clientes e projeto_disciplinas (com seus responsáveis) são
      // resolvidos à parte e remontados no mesmo formato de antes.
      const { data, error } = await supabase
        .from("projetos_safe")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const projetoIds = (data ?? []).map((p) => p.id).filter((id): id is string => !!id);
      const clienteIds = [...new Set((data ?? []).map((p) => p.cliente_id).filter((id): id is string => !!id))];

      const [{ data: clientesData }, { data: discData }] = await Promise.all([
        clienteIds.length > 0
          ? supabase.from("clientes").select("id, nome, email").in("id", clienteIds)
          : Promise.resolve({ data: [] as { id: string; nome: string; email: string }[] }),
        projetoIds.length > 0
          ? supabase
              .from("projeto_disciplinas")
              .select(
                `
                id, nome, status, data_inicio, data_fim, data_fim_real,
                prioridade, justificativa_atraso, horas_estimadas, custo_hora,
                observacoes, created_at, updated_at, projeto_id,
                projeto_disciplina_responsaveis (
                  pessoa_id,
                  pessoas ( id, nome )
                )
              `
              )
              .in("projeto_id", projetoIds)
          : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
      ]);

      const clienteById = new Map((clientesData ?? []).map((c) => [c.id, c]));
      const discsByProjeto = new Map<string, Array<Record<string, unknown>>>();
      for (const d of discData ?? []) {
        const projetoId = (d as { projeto_id: string }).projeto_id;
        const list = discsByProjeto.get(projetoId) ?? [];
        list.push(d as Record<string, unknown>);
        discsByProjeto.set(projetoId, list);
      }

      return (data || []).map((p) => {
        const proj = p as Record<string, unknown> & { id: string; cliente_id: string | null };
        const cliente = proj.cliente_id ? clienteById.get(proj.cliente_id) : undefined;
        const rawDiscs = (discsByProjeto.get(proj.id) ?? []) as Array<{
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
          cliente_nome: cliente?.nome,
          cliente_email: cliente?.email,
          localizacao: proj.localizacao as string | undefined,
          parcelas: proj.parcelas as string | undefined,
          area_m2: proj.area_m2 as number | undefined,
          data_inicio: proj.data_inicio as string,
          data_previsao: proj.data_previsao as string,
          data_final: proj.data_final as string | undefined,
          status: proj.status as Projeto["status"],
          etapa_id: (proj.etapa_id as string | null) ?? null,
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

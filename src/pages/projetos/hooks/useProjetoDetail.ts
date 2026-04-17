import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { useProjetoRentabilidade } from "@/hooks/useRentabilidade";
import { useTemplates } from "@/hooks/useTemplates";
import {
  useProjetoDisciplinas,
  useUpsertDisciplina,
  useDeleteDisciplina,
  useUpdateDisciplinaStatus,
} from "@/hooks/useProjetoDisciplinas";
import { PROJECT_PRIORITY, type ProjectPriority } from "@/constants";
import {
  type Projeto,
  type DisciplinaResponsavel,
  type ProjetoDisciplinaDB,
  dbDisciplinaToLegacy,
  getDeadlineStatus,
  getProjectProgress,
} from "../types";

export function useProjetoDetail(id: string | undefined) {
  const navigate = useNavigate();
  const { data: userRole } = useUserRole();
  const canEdit = userRole === "admin" || userRole === "operacional";
  const queryClient = useQueryClient();

  // ---- Project data via React Query ----
  const { data: projeto, isLoading: loading } = useQuery({
    queryKey: ["projeto-detail", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from("projetos").select("*, clientes(nome, email)").eq("id", id).single();

      if (error || !data) {
        navigate("/projetos");
        return null;
      }

      return {
        id: data.id,
        codigo_projeto: data.codigo_projeto,
        nome: data.nome,
        cliente_id: data.cliente_id,
        cliente_nome: (data as unknown as { clientes?: { nome?: string } }).clientes?.nome,
        cliente_email: (data as unknown as { clientes?: { email?: string } }).clientes?.email,
        localizacao: data.localizacao || undefined,
        parcelas: data.parcelas || undefined,
        area_m2: data.area_m2 || undefined,
        data_inicio: data.data_inicio,
        data_previsao: data.data_previsao,
        data_final: data.data_final || undefined,
        status: data.status as Projeto["status"],
        prioridade: (data.prioridade as ProjectPriority) || PROJECT_PRIORITY.MEDIA,
        valor_contrato: data.valor_contrato,
        observacao: data.observacao,
        disciplinas: [] as DisciplinaResponsavel[],
      } satisfies Projeto;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  });

  // ---- Rentabilidade ----
  const { data: rentabilidade } = useProjetoRentabilidade(id);

  // ---- Relational disciplinas ----
  const { data: dbDisciplinas = [] } = useProjetoDisciplinas(id);
  const upsertDisciplina = useUpsertDisciplina();
  const deleteDisciplinaMut = useDeleteDisciplina();
  const updateStatusMut = useUpdateDisciplinaStatus();

  const disciplinasLegacy: DisciplinaResponsavel[] = dbDisciplinas.map(dbDisciplinaToLegacy);

  // ---- Auxiliary data (catalogs) ----
  const [disciplinasCatalog, setDisciplinasCatalog] = useState<{ id: string; nome: string }[]>([]);
  const [pessoas, setPessoas] = useState<{ id: string; nome: string }[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string } | null>(null);
  const { data: templatesData = [] } = useTemplates();

  useEffect(() => {
    if (!canEdit) return;
    Promise.all([
      supabase.from("disciplinas").select("id, nome").order("nome"),
      supabase.from("pessoas").select("id, nome").order("nome"),
      supabase.from("clientes").select("id, nome").order("nome"),
      supabase.auth.getUser(),
    ]).then(([discRes, pesRes, cliRes, userRes]) => {
      if (discRes.data) setDisciplinasCatalog(discRes.data);
      if (pesRes.data) setPessoas(pesRes.data);
      if (cliRes.data) setClientes(cliRes.data);
      const user = userRes.data.user;
      if (user) {
        setCurrentUser({
          name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuário",
          email: user.email || "",
        });
      }
    });
  }, [canEdit]);

  // ---- Helpers ----
  const getDbDisc = useCallback((idx: number): ProjetoDisciplinaDB | undefined => dbDisciplinas[idx], [dbDisciplinas]);

  // ---- Disciplina mutations ----
  const applyDiscStatusChange = useCallback(
    async (idx: number, newStatus: string, justificativa?: string) => {
      if (!projeto) return;
      const dbDisc = dbDisciplinas[idx];
      if (!dbDisc) return;

      const isFinished = newStatus === "Concluído" && dbDisc.status !== "Concluído";

      try {
        await updateStatusMut.mutateAsync({
          id: dbDisc.id,
          projetoId: projeto.id,
          status: newStatus,
          justificativa_atraso: justificativa,
          data_fim_real:
            newStatus === "Concluído" && !dbDisc.data_fim_real ? new Date().toISOString().split("T")[0] : undefined,
        });
        toast.success(`${dbDisc.nome}: ${newStatus}`);

        if (isFinished) await sendDisciplinaEmail(dbDisc.nome);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erro desconhecido";
        toast.error("Erro ao atualizar");
      }
    },
    [projeto, dbDisciplinas, updateStatusMut, toast]
  );

  const sendDisciplinaEmail = async (disc: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("send-completed-subjects-email", {
        body: {
          email: projeto?.cliente_email,
          disciplina: disc,
        },
      });

      if (error) {
        toast.error(`Erro ao enviar email para o cliente ${projeto?.cliente_nome}.`);
        console.error("Erro na função:", error);
        return;
      }

      toast.success(`Email enviado com sucesso para o cliente ${projeto?.cliente_nome}.`);
    } catch (err) {
      console.error("Erro desconhecido:", err);
    }
  };

  const handleRemoveDisc = useCallback(
    async (idx: number) => {
      if (!projeto) return;
      const dbDisc = dbDisciplinas[idx];
      if (!dbDisc) return;
      try {
        await deleteDisciplinaMut.mutateAsync({ id: dbDisc.id, projetoId: projeto.id });
        toast.success("Disciplina removida");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erro desconhecido";
        toast.error("Erro ao remover");
      }
    },
    [projeto, dbDisciplinas, deleteDisciplinaMut, toast]
  );

  const handleAddDisc = useCallback(
    async (newDisc: { disciplina: string; responsavel_id: string }) => {
      if (!projeto || !newDisc.disciplina || !newDisc.responsavel_id) return;
      try {
        await upsertDisciplina.mutateAsync({
          projeto_id: projeto.id,
          nome: newDisc.disciplina,
          status: "Não Iniciado",
          responsavel_ids: [newDisc.responsavel_id],
        });
        toast.success("Disciplina adicionada");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erro desconhecido";
        toast.error("Erro ao adicionar");
      }
    },
    [projeto, upsertDisciplina, toast]
  );

  const handleSaveDiscChanges = useCallback(
    async (editingDiscLocal: ProjetoDisciplinaDB) => {
      if (!projeto) return;
      try {
        const responsavelIds = (editingDiscLocal.responsaveis || []).map((r) => r.id);
        await upsertDisciplina.mutateAsync({
          id: editingDiscLocal.id,
          projeto_id: projeto.id,
          nome: editingDiscLocal.nome,
          status: editingDiscLocal.status,
          data_inicio: editingDiscLocal.data_inicio,
          data_fim: editingDiscLocal.data_fim,
          data_fim_real: editingDiscLocal.data_fim_real,
          observacoes: editingDiscLocal.observacoes,
          prioridade: editingDiscLocal.prioridade,
          justificativa_atraso: editingDiscLocal.justificativa_atraso,
          horas_estimadas: editingDiscLocal.horas_estimadas,
          custo_hora: editingDiscLocal.custo_hora,
          responsavel_ids: responsavelIds,
        });
        toast.success("Disciplina atualizada");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erro desconhecido";
        toast.error("Erro ao salvar");
      }
    },
    [projeto, upsertDisciplina, toast]
  );

  const handleAddResponsavel = useCallback(
    async (discIdx: number, responsavelId: string) => {
      if (!projeto || !responsavelId) return;
      const dbDisc = dbDisciplinas[discIdx];
      if (!dbDisc) return;
      const pessoa = pessoas.find((p) => p.id === responsavelId);
      const currentIds = (dbDisc.responsaveis || []).map((r) => r.id);

      if (currentIds.includes(responsavelId)) {
        toast.error("Responsável já adicionado nesta disciplina");
        return;
      }

      try {
        await upsertDisciplina.mutateAsync({
          id: dbDisc.id,
          projeto_id: projeto.id,
          nome: dbDisc.nome,
          status: dbDisc.status,
          data_inicio: dbDisc.data_inicio,
          data_fim: dbDisc.data_fim,
          data_fim_real: dbDisc.data_fim_real,
          prioridade: dbDisc.prioridade,
          justificativa_atraso: dbDisc.justificativa_atraso,
          horas_estimadas: dbDisc.horas_estimadas,
          custo_hora: dbDisc.custo_hora,
          responsavel_ids: [...currentIds, responsavelId],
        });
        toast.success(`${pessoa?.nome} adicionado(a) a ${dbDisc.nome}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erro desconhecido";
        toast.error("Erro ao adicionar responsável");
      }
    },
    [projeto, dbDisciplinas, pessoas, upsertDisciplina, toast]
  );

  const handleRemoveResponsavel = useCallback(
    async (discIdx: number, respIdx: number) => {
      if (!projeto) return;
      const dbDisc = dbDisciplinas[discIdx];
      if (!dbDisc) return;
      const currentIds = (dbDisc.responsaveis || []).map((r) => r.id);

      if (currentIds.length <= 1) {
        toast.error("A disciplina precisa ter ao menos um responsável");
        return;
      }

      const newIds = currentIds.filter((_, i) => i !== respIdx);
      try {
        await upsertDisciplina.mutateAsync({
          id: dbDisc.id,
          projeto_id: projeto.id,
          nome: dbDisc.nome,
          status: dbDisc.status,
          data_inicio: dbDisc.data_inicio,
          data_fim: dbDisc.data_fim,
          data_fim_real: dbDisc.data_fim_real,
          prioridade: dbDisc.prioridade,
          justificativa_atraso: dbDisc.justificativa_atraso,
          horas_estimadas: dbDisc.horas_estimadas,
          custo_hora: dbDisc.custo_hora,
          responsavel_ids: newIds,
        });
        toast.success("Responsável removido");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erro desconhecido";
        toast.error("Erro ao remover responsável");
      }
    },
    [projeto, dbDisciplinas, upsertDisciplina, toast]
  );

  // ---- Refetch project after edit ----
  const refetchProjeto = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["projeto-detail", id] });
  }, [queryClient, id]);

  // ---- Derived data ----
  const deadline = projeto ? getDeadlineStatus(projeto) : null;
  const progress = getProjectProgress(disciplinasLegacy);
  const margemBrutaPct = rentabilidade?.margem_bruta_pct ?? null;

  return {
    // Core data
    projeto,
    loading,
    canEdit,

    // Disciplinas
    disciplinasLegacy,
    dbDisciplinas,
    disciplinasCatalog,
    pessoas,
    getDbDisc,

    // Derived
    deadline,
    progress,
    margemBrutaPct,

    // Mutations
    applyDiscStatusChange,
    handleRemoveDisc,
    handleAddDisc,
    handleSaveDiscChanges,
    handleAddResponsavel,
    handleRemoveResponsavel,

    // Edit dialog support
    clientes,
    currentUser,
    templatesData,
    refetchProjeto,
  };
}

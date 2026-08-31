import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { monitoring } from "@/lib/monitoring";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { toast } from "sonner";
import { useProjetoRentabilidade } from "@/hooks/useRentabilidade";
import { useTemplates } from "@/hooks/useTemplates";
import { errorMessage } from "@/lib/errors";
import {
  useProjetoDisciplinas,
  useUpsertDisciplina,
  useDeleteDisciplina,
  useUpdateDisciplinaStatus,
} from "@/hooks/useProjetoDisciplinas";
import { PROJECT_PRIORITY, PROJECT_STATUS, PROJECT_STATUS_CONFIG, type ProjectPriority } from "@/constants";
import {
  type Projeto,
  type DisciplinaResponsavel,
  type ProjetoDisciplinaDB,
  dbDisciplinaToLegacy,
  getDeadlineStatus,
  getProjectProgress,
} from "@/types/projetos";

export function useProjetoDetail(id: string | undefined) {
  const navigate = useNavigate();
  const { canEdit } = useFeatureAccess("projetos");
  const queryClient = useQueryClient();

  // ---- Project data via React Query ----
  const { data: projeto, isLoading: loading } = useQuery({
    queryKey: ["projeto-detail", id],
    queryFn: async () => {
      if (!id) return null;
      // projetos_safe mascara valor_contrato sem financeiro; view não embeda
      // clientes(nome,email) via PostgREST (sem FK visível), resolve à parte.
      const { data, error } = await supabase.from("projetos_safe").select("*").eq("id", id).single();

      if (error || !data) {
        navigate("/projetos");
        return null;
      }

      const cliente = data.cliente_id
        ? (await supabase.from("clientes").select("nome, email").eq("id", data.cliente_id).maybeSingle()).data
        : null;

      return {
        id: data.id ?? id,
        codigo_projeto: data.codigo_projeto ?? "",
        nome: data.nome ?? "",
        cliente_id: data.cliente_id ?? "",
        cliente_nome: cliente?.nome ?? undefined,
        cliente_email: cliente?.email ?? undefined,
        localizacao: data.localizacao || undefined,
        parcelas: data.parcelas || undefined,
        area_m2: data.area_m2 || undefined,
        data_inicio: data.data_inicio ?? "",
        data_previsao: data.data_previsao ?? "",
        data_final: data.data_final || undefined,
        status: data.status as Projeto["status"],
        prioridade: (data.prioridade as ProjectPriority) || PROJECT_PRIORITY.MEDIA,
        valor_contrato: data.valor_contrato ?? 0,
        observacao: data.observacao ?? "",
        disciplinas: [] as DisciplinaResponsavel[],
      } satisfies Projeto;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  });

  // ---- Rentabilidade ----
  const { data: rentabilidade, isLoading: rentabilidadeLoading } = useProjetoRentabilidade(id);

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
      supabase.from("pessoas").select("id, nome").is("deleted_at", null).order("nome"),
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
    async (idx: number, newStatus: string, justificativa?: string, dataFimRealOverride?: string) => {
      if (!projeto) return;
      const dbDisc = dbDisciplinas[idx];
      if (!dbDisc) return;

      const isFinished = newStatus === "Concluído" && dbDisc.status !== "Concluído";

      // Prioridade: override explícito do dialog > data_fim_real já gravada > hoje.
      // Permite o usuário registrar entrega passada sem o sistema forçar "hoje".
      const resolvedDataFim =
        newStatus === "Concluído"
          ? dataFimRealOverride || (!dbDisc.data_fim_real ? new Date().toISOString().split("T")[0] : undefined)
          : undefined;

      try {
        await updateStatusMut.mutateAsync({
          id: dbDisc.id,
          projetoId: projeto.id,
          status: newStatus,
          justificativa_atraso: justificativa,
          data_fim_real: resolvedDataFim,
        });
        toast.success(`${dbDisc.nome}: ${newStatus}`);

        // Ao concluir, notifica in-app (sino) os responsáveis da próxima etapa do
        // fluxo — nunca o cliente, que segue avisado só manualmente fora daqui.
        if (isFinished) {
          void notifyNextStage(dbDisc.id);
        }
      } catch (err: unknown) {
        monitoring.captureException(err, { context: "handleStatusChange" });
        toast.error("Erro ao atualizar");
      }
    },
    [projeto, dbDisciplinas, updateStatusMut, toast]
  );

  const notifyNextStage = async (disciplinaId: string) => {
    try {
      const { error } = await supabase.rpc("rpc_notificar_proxima_etapa", {
        p_disciplina_id: disciplinaId,
      });
      if (error) {
        monitoring.captureException(error, { context: "notify-next-stage" });
      }
    } catch (err) {
      monitoring.captureException(err, { context: "notify-next-stage unexpected" });
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
        toast.error("Erro ao remover", { description: errorMessage(err) });
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
        toast.error("Erro ao adicionar disciplina", { description: errorMessage(err) });
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
          horas_realizadas: editingDiscLocal.horas_realizadas,
          custo_hora: editingDiscLocal.custo_hora,
          descricao: editingDiscLocal.descricao,
          labels: editingDiscLocal.labels,
          links: editingDiscLocal.links,
          comentarios: editingDiscLocal.comentarios,
          responsavel_ids: responsavelIds,
        });
        toast.success("Disciplina atualizada");
      } catch (err: unknown) {
        toast.error("Erro ao salvar", { description: errorMessage(err) });
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
        toast.error("Erro ao remover responsável");
      }
    },
    [projeto, dbDisciplinas, upsertDisciplina, toast]
  );

  // ---- Refetch project after edit ----
  const refetchProjeto = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["projeto-detail", id] });
  }, [queryClient, id]);

  // ---- Quick edit inline (header/KPIs) — patch pontual, sem passar pela RPC
  // completa de update_projeto_completo (que também revalida disciplinas). ----
  const invalidateProjeto = useCallback(() => {
    refetchProjeto();
    queryClient.invalidateQueries({ queryKey: ["projetos"] });
  }, [refetchProjeto, queryClient]);

  const handleQuickUpdateProjeto = useCallback(
    async (patch: {
      data_previsao?: string;
      valor_contrato?: number;
      area_m2?: number;
      prioridade?: ProjectPriority;
    }) => {
      if (!projeto) return;

      // Guarda-chuva: a nova previsão não pode ficar antes de uma disciplina já
      // agendada (mesma checagem do ProjetoFormDialog, só que pra 1 campo).
      if (patch.data_previsao) {
        const violacao = disciplinasLegacy.find(
          (d) =>
            (d.data_previsao && d.data_previsao > patch.data_previsao!) ||
            (d.data_final && d.data_final > patch.data_previsao!)
        );
        if (violacao) {
          toast.error("Data inválida", {
            description: `A disciplina "${violacao.disciplina}" tem data além dessa previsão`,
          });
          return;
        }
      }

      try {
        const { error } = await supabase
          .from("projetos")
          .update(patch as never)
          .eq("id", projeto.id);
        if (error) throw error;
        toast.success("Projeto atualizado");
        invalidateProjeto();
      } catch (err: unknown) {
        toast.error("Erro ao salvar", { description: errorMessage(err) });
      }
    },
    [projeto, disciplinasLegacy, invalidateProjeto, toast]
  );

  // Reabertura: sair de "Concluído" pede confirmação antes de zerar data_final
  // (mesma regra do Kanban, ver useProjetoStatusMove) — evita perda silenciosa.
  const [pendingReopenStatus, setPendingReopenStatus] = useState<string | null>(null);

  const applyStatusUpdate = useCallback(
    async (newStatus: string, clearDataFinal: boolean) => {
      if (!projeto) return;
      const updateData: Record<string, string | null> = { status: newStatus };
      if (clearDataFinal) updateData.data_final = null;

      try {
        const { error } = await supabase
          .from("projetos")
          .update(updateData as never)
          .eq("id", projeto.id);
        if (error) throw error;
        toast.success(
          `Status: ${PROJECT_STATUS_CONFIG[newStatus as keyof typeof PROJECT_STATUS_CONFIG]?.label ?? newStatus}`
        );
        invalidateProjeto();
        if (newStatus !== PROJECT_STATUS.CANCELADO) {
          const { error: notifyError } = await supabase.rpc("rpc_notificar_projeto_status", {
            p_projeto_id: projeto.id,
            p_novo_status: newStatus,
          });
          if (notifyError) monitoring.captureException(notifyError, { context: "notifyProjectStatusChange" });
        }
      } catch (err: unknown) {
        toast.error("Erro ao mudar status", { description: errorMessage(err) });
      }
    },
    [projeto, invalidateProjeto, toast]
  );

  const handleQuickUpdateStatus = useCallback(
    (newStatus: string) => {
      if (!projeto) return;
      if (projeto.status === PROJECT_STATUS.CONCLUIDO && newStatus !== PROJECT_STATUS.CONCLUIDO) {
        setPendingReopenStatus(newStatus);
        return;
      }
      void applyStatusUpdate(newStatus, false);
    },
    [projeto, applyStatusUpdate]
  );

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
    rentabilidade,
    rentabilidadeLoading,

    // Mutations
    applyDiscStatusChange,
    handleRemoveDisc,
    handleAddDisc,
    handleSaveDiscChanges,
    handleAddResponsavel,
    handleRemoveResponsavel,

    // Quick edit inline (header/KPIs do projeto)
    handleQuickUpdateProjeto,
    handleQuickUpdateStatus,
    pendingReopenStatus,
    setPendingReopenStatus,
    applyStatusUpdate,

    // Edit dialog support
    clientes,
    currentUser,
    templatesData,
    refetchProjeto,
  };
}

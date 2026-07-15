import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { type DropResult } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { monitoring } from "@/lib/monitoring";
import { PROJECT_STATUS, PROJECT_STATUS_CONFIG } from "@/constants";
import { type Projeto } from "@/types/projetos";

const statusConfig = PROJECT_STATUS_CONFIG;

// Regra de mudança de status do projeto: update otimista no cache + banco,
// confirmação de notificação por email (pendingDrag), e confirmação de reabertura
// ao sair da coluna "Concluído" (pendingReopen, que zera data_final). Preserva
// exatamente a lógica otimista, de invalidação e de notificação da página original.
export function useProjetoStatusMove(projetos: Projeto[], canEdit: boolean) {
  const queryClient = useQueryClient();

  const [pendingDrag, setPendingDrag] = useState<{
    projetoId: string;
    newStatus: string;
    projetoNome?: string;
  } | null>(null);

  // Reabertura: quando projeto sai da coluna "Concluído", pede confirmação
  // antes de remover a data_final registrada — evita perda silenciosa em drag acidental.
  const [pendingReopen, setPendingReopen] = useState<{
    projetoId: string;
    newStatus: string;
    projetoNome: string;
    dataFinal?: string;
  } | null>(null);

  // Aplica a mudança de status no cache e no banco.
  // clearDataFinal=true zera data_final (usado na reabertura de projeto concluído).
  const applyStatusMove = async (projetoId: string, newStatus: string, clearDataFinal = false) => {
    // NÃO forçamos data_final=hoje ao concluir: o trigger auto_complete_disciplinas
    // (mig 20260519000000) preenche com MAX(data_fim_real) das disciplinas — a entrega
    // real, não o momento administrativo do toggle. Forçar "hoje" aqui gerava
    // "Concluído com Atraso" falso. Deixamos o banco decidir e o refetch traz o valor.
    queryClient.setQueryData(["projetos"], (old: Projeto[] | undefined) =>
      (old || []).map((p) =>
        p.id === projetoId
          ? {
              ...p,
              status: newStatus as Projeto["status"],
              data_final: clearDataFinal ? undefined : p.data_final,
            }
          : p
      )
    );
    const updateData: Record<string, string | null> = { status: newStatus };
    if (clearDataFinal) updateData.data_final = null;

    const { error } = await supabase.from("projetos").update(updateData).eq("id", projetoId);
    if (error) {
      toast.error("Erro ao mover projeto");
      // Reverte o cache otimista buscando o estado real do servidor.
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
      return false;
    }
    toast.success(`Movido para ${statusConfig[newStatus as keyof typeof statusConfig]?.label}`);
    // Confia no update otimista. Só revalida quando o servidor pode ter mexido
    // em data_final: ao concluir (trigger preenche) ou reabrir (limpamos).
    if (newStatus === PROJECT_STATUS.CONCLUIDO || clearDataFinal) {
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
    }
    return true;
  };

  const handleMoveStatus = async (projetoId: string, newStatus: string) => {
    const projeto = projetos.find((p) => p.id === projetoId);
    const fromStatus = projeto?.status;

    // Reabrindo um projeto concluído? Pede confirmação antes de zerar data_final.
    if (fromStatus === PROJECT_STATUS.CONCLUIDO && newStatus !== PROJECT_STATUS.CONCLUIDO) {
      setPendingReopen({
        projetoId,
        newStatus,
        projetoNome: projeto?.nome ?? "Projeto",
        dataFinal: projeto?.data_final,
      });
      return;
    }

    const ok = await applyStatusMove(projetoId, newStatus);
    if (!ok) return;

    if (newStatus !== PROJECT_STATUS.CANCELADO) {
      setPendingDrag({
        projetoId,
        newStatus,
        projetoNome: projeto?.nome ?? undefined,
      });
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;
    if (!canEdit) return;

    const newStatus = destination.droppableId as Projeto["status"];
    const fromStatus = source.droppableId;
    const projeto = projetos.find((p) => p.id === draggableId);

    // Saindo da coluna Concluído? Pede confirmação antes de zerar data_final.
    if (fromStatus === PROJECT_STATUS.CONCLUIDO && newStatus !== PROJECT_STATUS.CONCLUIDO) {
      setPendingReopen({
        projetoId: draggableId,
        newStatus,
        projetoNome: projeto?.nome ?? "Projeto",
        dataFinal: projeto?.data_final,
      });
      return;
    }

    const ok = await applyStatusMove(draggableId, newStatus);
    if (!ok) return;

    if (newStatus !== PROJECT_STATUS.CANCELADO) {
      setPendingDrag({
        projetoId: draggableId,
        newStatus,
        projetoNome: projeto?.nome ?? undefined,
      });
    }
  };

  const notifyProjectStatusChange = async (draggableId: string, newStatus: string) => {
    try {
      const { error } = await supabase.functions.invoke("notify-project-people", {
        body: { projetoId: draggableId, novoStatus: newStatus },
      });
      if (error) {
        toast.error("Erro ao enviar notificação por email");
        return;
      }
      toast.success("Notificação por email enviada");
    } catch (err) {
      monitoring.captureException(err, { context: "notifyProjectStatusChange" });
    }
  };

  return {
    pendingDrag,
    setPendingDrag,
    pendingReopen,
    setPendingReopen,
    applyStatusMove,
    handleMoveStatus,
    onDragEnd,
    notifyProjectStatusChange,
  };
}

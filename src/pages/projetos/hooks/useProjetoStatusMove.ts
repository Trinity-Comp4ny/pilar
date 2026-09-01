import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { type DropResult } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { PROJECT_STATUS, PROJECT_STATUS_CONFIG } from "@/constants";
import { type Projeto } from "@/types/projetos";
import { type ProjetoEtapa } from "@/pages/projetos/hooks/useProjetoEtapas";

const statusConfig = PROJECT_STATUS_CONFIG;

type PendingMove = {
  projetoId: string;
  /** Status canônico de destino (o bucket da etapa). */
  newStatus: string;
  /** Etapa de destino no desktop; ausente no mobile (que move por status). */
  etapaId?: string;
  projetoNome?: string;
  dataFinal?: string;
};

// Regra de mudança de status/coluna do projeto: update otimista no cache + banco,
// e confirmação de reabertura ao sair de uma coluna do bucket "Concluído"
// (pendingReopen, que zera data_final). No desktop o board
// move por etapa_id (o status deriva do bucket no banco); no mobile, que agrupa
// pelos 6 status canônicos, move por status direto.
export function useProjetoStatusMove(projetos: Projeto[], canEdit: boolean, etapas: ProjetoEtapa[] = []) {
  const queryClient = useQueryClient();

  const bucketDe = (etapaId?: string | null) => etapas.find((e) => e.id === etapaId)?.bucket;
  const nomeDe = (etapaId?: string | null) => etapas.find((e) => e.id === etapaId)?.nome;

  // Reabertura: quando projeto sai de uma coluna "Concluído", pede confirmação
  // antes de remover a data_final registrada — evita perda silenciosa em drag acidental.
  const [pendingReopen, setPendingReopen] = useState<
    | (Required<Pick<PendingMove, "projetoId" | "newStatus" | "projetoNome">> & {
        etapaId?: string;
        dataFinal?: string;
      })
    | null
  >(null);

  // Aplica a mudança no cache e no banco. Quando `etapaId` vem, grava a coluna
  // (o trigger deriva o status pelo bucket); senão grava o status direto (mobile).
  // clearDataFinal=true zera data_final (usado na reabertura de projeto concluído).
  const applyStatusMove = async (projetoId: string, newStatus: string, clearDataFinal = false, etapaId?: string) => {
    // NÃO forçamos data_final=hoje ao concluir: o trigger auto_complete_disciplinas
    // (mig 20260519000000) preenche com MAX(data_fim_real) das disciplinas — a entrega
    // real, não o momento administrativo do toggle. Deixamos o banco decidir e o refetch traz o valor.
    queryClient.setQueryData(["projetos"], (old: Projeto[] | undefined) =>
      (old || []).map((p) =>
        p.id === projetoId
          ? {
              ...p,
              status: newStatus as Projeto["status"],
              etapa_id: etapaId ?? p.etapa_id,
              data_final: clearDataFinal ? undefined : p.data_final,
            }
          : p
      )
    );
    const updateData: Record<string, string | null> = etapaId ? { etapa_id: etapaId } : { status: newStatus };
    if (clearDataFinal) updateData.data_final = null;

    const { error } = await supabase
      .from("projetos")
      .update(updateData as never)
      .eq("id", projetoId);
    if (error) {
      toast.error("Erro ao mover projeto");
      // Reverte o cache otimista buscando o estado real do servidor.
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
      return false;
    }
    const label = nomeDe(etapaId) ?? statusConfig[newStatus as keyof typeof statusConfig]?.label ?? newStatus;
    toast.success(`Movido para ${label}`);
    // Confia no update otimista. Só revalida quando o servidor pode ter mexido
    // em data_final: ao concluir (trigger preenche) ou reabrir (limpamos).
    if (newStatus === PROJECT_STATUS.CONCLUIDO || clearDataFinal) {
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
    }
    return true;
  };

  // Mobile: move pelo status canônico (as colunas do mobile são os 6 buckets).
  const handleMoveStatus = async (projetoId: string, newStatus: string) => {
    const projeto = projetos.find((p) => p.id === projetoId);
    const fromStatus = projeto?.status;

    if (fromStatus === PROJECT_STATUS.CONCLUIDO && newStatus !== PROJECT_STATUS.CONCLUIDO) {
      setPendingReopen({
        projetoId,
        newStatus,
        projetoNome: projeto?.nome ?? "Projeto",
        dataFinal: projeto?.data_final,
      });
      return;
    }

    await applyStatusMove(projetoId, newStatus);
  };

  // Desktop: move por etapa (droppableId = etapa.id). As âncoras (reabrir concluído,
  // não notificar cancelado) olham o bucket da etapa de origem/destino.
  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;
    if (!canEdit) return;

    const etapaDestino = destination.droppableId;
    const bucketDestino = bucketDe(etapaDestino);
    const bucketOrigem = bucketDe(source.droppableId);
    if (!bucketDestino) return;
    const projeto = projetos.find((p) => p.id === draggableId);

    // Saindo de uma coluna Concluído? Pede confirmação antes de zerar data_final.
    if (bucketOrigem === PROJECT_STATUS.CONCLUIDO && bucketDestino !== PROJECT_STATUS.CONCLUIDO) {
      setPendingReopen({
        projetoId: draggableId,
        newStatus: bucketDestino,
        etapaId: etapaDestino,
        projetoNome: projeto?.nome ?? "Projeto",
        dataFinal: projeto?.data_final,
      });
      return;
    }

    await applyStatusMove(draggableId, bucketDestino, false, etapaDestino);
  };

  return {
    pendingReopen,
    setPendingReopen,
    applyStatusMove,
    handleMoveStatus,
    onDragEnd,
  };
}

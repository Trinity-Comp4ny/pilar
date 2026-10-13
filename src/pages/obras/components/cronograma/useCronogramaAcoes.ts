import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useCreateFrente,
  useDeleteFrente,
  useUpdateFrente,
  type AtualizaFrente,
  type ObraFrenteRow,
} from "@/pages/obras/hooks/useObraFrentes";
import {
  useCreateObraTarefa,
  useDeleteObraTarefa,
  useUpdateObraTarefa,
  type PatchObraTarefa,
} from "@/pages/obras/hooks/useObraTarefas";
import { useTarefaMutations } from "@/pages/meu-trabalho/hooks";
import type { NivelCronograma } from "@/lib/obraArvore";
import { analytics } from "@/lib/analytics";

function mensagem(e: unknown): string {
  return e instanceof Error ? e.message : "Tente novamente";
}

/**
 * Todas as escritas do cronograma da obra, com o toast de erro já resolvido, para
 * a Lista e o Gantt chamarem do mesmo jeito.
 */
export function useCronogramaAcoes(obraId: string, projetoId: string | null, nos: ReadonlyArray<ObraFrenteRow>) {
  const qc = useQueryClient();
  const createNo = useCreateFrente(obraId);
  const updateNo = useUpdateFrente(obraId);
  const deleteNo = useDeleteFrente(obraId);
  const createTarefa = useCreateObraTarefa(obraId, projetoId);
  const updateTarefa = useUpdateObraTarefa(obraId);
  const deleteTarefa = useDeleteObraTarefa(obraId);
  const { atualizar: atualizarNaGestao } = useTarefaMutations();

  const irmaos = (parentId: string | null) => nos.filter((n) => (n.parent_id ?? null) === parentId);

  const criarNo = async (nivel: NivelCronograma, parentId: string | null, nome: string) => {
    const pai = parentId ? nos.find((n) => n.id === parentId) : undefined;
    try {
      await createNo.mutateAsync({
        nome,
        nivel,
        parent_id: parentId,
        ordem: irmaos(parentId).length,
        // Nasce com o período do pai: já aparece no Gantt para ajustar.
        data_inicio: pai?.data_inicio ?? null,
        data_fim: pai?.data_fim ?? null,
      });
      analytics.track("cronograma_item_criado", { nivel });
      return true;
    } catch (e) {
      toast.error("Não foi possível criar", { description: mensagem(e) });
      return false;
    }
  };

  const atualizarNo = async (campos: AtualizaFrente) => {
    try {
      await updateNo.mutateAsync(campos);
    } catch (e) {
      toast.error("Não foi possível salvar", { description: mensagem(e) });
    }
  };

  /** Sobe ou desce o nó entre os irmãos, renumerando a ordem de todos. */
  const moverNo = async (id: string, direcao: -1 | 1) => {
    const no = nos.find((n) => n.id === id);
    if (!no) return;
    const lista = irmaos(no.parent_id ?? null).sort(
      (a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at)
    );
    const i = lista.findIndex((n) => n.id === id);
    const j = i + direcao;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    try {
      await Promise.all(
        lista.map((n, ordem) => (n.ordem === ordem ? null : updateNo.mutateAsync({ id: n.id, ordem }))).filter(Boolean)
      );
    } catch (e) {
      toast.error("Não foi possível reordenar", { description: mensagem(e) });
    }
  };

  const excluirNo = async (id: string) => {
    try {
      await deleteNo.mutateAsync(id);
      return true;
    } catch (e) {
      toast.error("Não foi possível excluir", { description: mensagem(e) });
      return false;
    }
  };

  const criarTarefa = async (servico: ObraFrenteRow, titulo: string) => {
    try {
      await createTarefa.mutateAsync({
        titulo,
        obra_frente_id: servico.id,
        data_inicio: servico.data_inicio ?? null,
        prazo: servico.data_fim ?? null,
      });
      analytics.track("cronograma_item_criado", { nivel: "tarefa" });
      return true;
    } catch (e) {
      toast.error("Não foi possível criar a tarefa", { description: mensagem(e) });
      return false;
    }
  };

  const atualizarTarefa = async (patch: PatchObraTarefa) => {
    try {
      await updateTarefa.mutateAsync(patch);
      if (patch.status === "concluida") analytics.track("cronograma_tarefa_concluida");
    } catch (e) {
      toast.error("Não foi possível salvar a tarefa", { description: mensagem(e) });
    }
  };

  /** Mesmo caminho da gestão de tarefas: grava o primário e regrava a ponte. */
  const definirResponsaveis = async (tarefaId: string, pessoaIds: string[]) => {
    try {
      await atualizarNaGestao.mutateAsync({ id: tarefaId, input: { responsaveis: pessoaIds } });
      await qc.invalidateQueries({ queryKey: ["obra_tarefas", obraId] });
    } catch (e) {
      toast.error("Não foi possível trocar o responsável", { description: mensagem(e) });
    }
  };

  const excluirTarefa = async (id: string) => {
    try {
      await deleteTarefa.mutateAsync(id);
      return true;
    } catch (e) {
      toast.error("Não foi possível excluir a tarefa", { description: mensagem(e) });
      return false;
    }
  };

  return {
    criarNo,
    atualizarNo,
    moverNo,
    excluirNo,
    criarTarefa,
    atualizarTarefa,
    definirResponsaveis,
    excluirTarefa,
    salvando: updateNo.isPending || updateTarefa.isPending,
    excluindo: deleteNo.isPending || deleteTarefa.isPending,
  };
}

export type CronogramaAcoes = ReturnType<typeof useCronogramaAcoes>;

import type { TarefaItem } from "@/hooks/tarefas/useTarefas";

export function tarefaAtrasada(tarefa: TarefaItem, hoje: string) {
  return tarefa.status !== "concluida" && !!tarefa.prazo && tarefa.prazo < hoje;
}

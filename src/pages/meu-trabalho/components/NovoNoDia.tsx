import { useState, type ReactNode } from "react";
import { CheckSquare, Video } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  /** Só quem tem o Google Agenda conectado pode criar reunião; sem isso, só tarefa (sem escolha). */
  podeReuniao: boolean;
  /** Escolheu "Reunião": quem chama abre o diálogo da reunião naquele dia. */
  onReuniao: () => void;
  /** Formulário curto da tarefa. */
  children: ReactNode;
};

/**
 * Conteúdo do "+" de um dia da Agenda: escolhe entre tarefa e reunião. Disciplina não nasce
 * aqui (vem do projeto). Sem Google Agenda conectado, vai direto para o formulário da tarefa.
 */
export function NovoNoDia({ podeReuniao, onReuniao, children }: Props) {
  const [escolhido, setEscolhido] = useState(false);
  if (!podeReuniao || escolhido) return <>{children}</>;

  const opcao = "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted";
  return (
    <div className="space-y-1" role="group" aria-label="O que criar neste dia">
      <button type="button" className={cn(opcao)} onClick={() => setEscolhido(true)}>
        <CheckSquare className="h-4 w-4 text-muted-foreground" />
        Tarefa
      </button>
      <button type="button" className={cn(opcao)} onClick={onReuniao}>
        <Video className="h-4 w-4 text-muted-foreground" />
        Reunião
      </button>
    </div>
  );
}

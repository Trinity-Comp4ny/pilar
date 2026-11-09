import { toast } from "sonner";
import { mensagemDaPausa } from "@/pages/projetos/lib/pausa";
import { PausarDialog } from "./PausarDialog";
import { useDisciplinasAbertasDoProjeto, useProjetoPausas } from "../hooks/useProjetoPausas";

interface PausarProjetoDialogProps {
  projetoId: string | undefined;
  projetoNome: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PausarProjetoDialog({ projetoId, projetoNome, open, onOpenChange }: PausarProjetoDialogProps) {
  const { pausar: pausarProjeto } = useProjetoPausas(projetoId);
  const abertas = useDisciplinasAbertasDoProjeto(projetoId, open).data ?? 0;

  const aviso =
    abertas > 0
      ? `${abertas} ${abertas === 1 ? "disciplina aberta será pausada" : "disciplinas abertas serão pausadas"}. As concluídas não mudam.`
      : undefined;

  const confirmar = (motivo: string) =>
    pausarProjeto.mutate(motivo, {
      onSuccess: () => {
        toast.success("Projeto pausado. Os prazos ficam congelados até você retomar.");
        onOpenChange(false);
      },
      onError: (e) =>
        toast.error(mensagemDaPausa(e, "Não foi possível pausar o projeto. Nada foi alterado. Tente de novo.")),
    });

  return (
    <PausarDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Pausar projeto"
      description={`${projetoNome}. Os prazos ficam congelados até você retomar.`}
      aviso={aviso}
      dica="O motivo fica no histórico do projeto. O cliente não vê."
      isPending={pausarProjeto.isPending}
      onConfirmar={confirmar}
    />
  );
}

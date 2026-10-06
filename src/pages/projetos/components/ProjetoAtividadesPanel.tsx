import { useProjetoAtividades } from "../hooks/useProjetoAtividades";
import { AtividadeComposer } from "./AtividadeComposer";
import { notificarMencao } from "@/lib/notificarMencao";
import { ComentarioCard } from "@/components/atividades/ComentarioCard";

interface ProjetoAtividadesPanelProps {
  projetoId: string;
  pessoas: { id: string; nome: string }[];
  autorNome: string;
  /** Comentário de destino de um link de notificação (spec 103). */
  comentarioDestacado?: string | null;
}

/** Painel de atividades do projeto (só comentários; os links vivem no conteúdo). */
export function ProjetoAtividadesPanel({
  projetoId,
  pessoas,
  autorNome,
  comentarioDestacado,
}: ProjetoAtividadesPanelProps) {
  const { comentarios, salvar } = useProjetoAtividades(projetoId);

  const adicionar = (texto: string, mencionados: string[]) => {
    const id = crypto.randomUUID();
    salvar.mutate(
      {
        comentarios: [
          ...comentarios,
          {
            id,
            texto,
            autor: autorNome,
            data: new Date().toISOString(),
            mencionados: mencionados.length ? mencionados : undefined,
          },
        ],
      },
      { onSuccess: () => notificarMencao("projeto", projetoId, mencionados, texto, id) }
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 min-h-0 space-y-2 overflow-y-auto">
        {comentarios.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">Nenhuma atividade ainda</p>
        ) : (
          comentarios.map((c) => (
            <ComentarioCard key={c.id} comentario={c} pessoas={pessoas} destacado={c.id === comentarioDestacado} />
          ))
        )}
      </div>
      <div className="shrink-0 pt-3">
        <AtividadeComposer pessoas={pessoas} onSubmit={adicionar} />
      </div>
    </div>
  );
}

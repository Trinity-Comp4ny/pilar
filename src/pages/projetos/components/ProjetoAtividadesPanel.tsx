import { useProjetoAtividades } from "../hooks/useProjetoAtividades";
import { AtividadeComposer } from "@/components/atividades/AtividadeComposerComMencoes";
import { notificarMencao } from "@/lib/notificarMencao";
import { ComentariosLista } from "@/components/atividades/ComentariosLista";
import { useComentarioAutoria } from "@/hooks/useComentarioAutoria";

import { RegistrosProjeto } from "./RegistrosProjeto";
import type { DisciplinaAditivo } from "./AditivoProjetoDialogs";

interface ProjetoAtividadesPanelProps {
  projetoId: string;
  pessoas: { id: string; nome: string }[];
  autorNome: string;
  /** Comentário de destino de um link de notificação (spec 103). */
  comentarioDestacado?: string | null;
  canEdit?: boolean;
  podeCriarAditivo?: boolean;
  disciplinas?: DisciplinaAditivo[];
}

/** Painel de atividades do projeto (só comentários; os links vivem no conteúdo). */
export function ProjetoAtividadesPanel({
  projetoId,
  pessoas,
  autorNome,
  comentarioDestacado,
  canEdit = false,
  podeCriarAditivo = false,
  disciplinas,
}: ProjetoAtividadesPanelProps) {
  const { comentarios, salvar } = useProjetoAtividades(projetoId);
  const { autorId } = useComentarioAutoria(autorNome);

  const excluir = (id: string) => salvar.mutateAsync({ comentarios: comentarios.filter((c) => c.id !== id) });

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
            autorId,
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
        {disciplinas && (
          <RegistrosProjeto
            projetoId={projetoId}
            pessoas={pessoas}
            disciplinas={disciplinas}
            canEdit={canEdit}
            podeCriarAditivo={podeCriarAditivo}
          />
        )}
        <ComentariosLista
          comentarios={comentarios}
          pessoas={pessoas}
          autorNome={autorNome}
          destacadoId={comentarioDestacado}
          vazio={disciplinas ? "Nenhum comentário ainda" : "Nenhuma atividade ainda"}
          onExcluir={excluir}
          entidade={{ tipo: "projeto", id: projetoId }}
        />
      </div>
      <div className="shrink-0 pt-3">
        <AtividadeComposer pessoas={pessoas} onSubmit={adicionar} />
      </div>
    </div>
  );
}

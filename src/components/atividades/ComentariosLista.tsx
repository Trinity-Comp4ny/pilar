import { ComentarioCard, type ComentarioExibido } from "./ComentarioCard";
import { useComentarioAutoria } from "@/hooks/useComentarioAutoria";
import { apagarNotificacoesComentario, type EntidadeMencao } from "@/lib/notificarMencao";

interface ComentariosListaProps {
  comentarios: ComentarioExibido[];
  pessoas: { id: string; nome: string }[];
  /** Nome com que a tela assina os comentários (reconhece os antigos, sem autorId). */
  autorNome?: string;
  /** Comentário de destino de um link de notificação. */
  destacadoId?: string | null;
  vazio?: string;
  /** Apaga pelo id. Sem ele, ninguém apaga (tela só leitura). */
  onExcluir?: (id: string) => void | Promise<void>;
  /**
   * Item já gravado com a exclusão: depois do `onExcluir`, a notificação de menção do
   * comentário sai do sino. Omitir quando a exclusão só grava depois (tarefa, no Salvar).
   */
  entidade?: { tipo: EntidadeMencao; id: string };
}

/**
 * Lista de comentários das Atividades (projeto, disciplina, tarefa). A lixeira só
 * aparece em quem o usuário pode apagar: admin/coordenador qualquer um, demais os próprios.
 */
export function ComentariosLista({
  comentarios,
  pessoas,
  autorNome,
  destacadoId,
  vazio = "Nenhum comentário ainda",
  onExcluir,
  entidade,
}: ComentariosListaProps) {
  const { podeExcluir } = useComentarioAutoria(autorNome);

  const excluir = async (id: string) => {
    await onExcluir?.(id);
    if (entidade) await apagarNotificacoesComentario(entidade.tipo, entidade.id, id);
  };

  if (comentarios.length === 0) {
    return <p className="py-8 text-center text-xs text-muted-foreground">{vazio}</p>;
  }

  return (
    <>
      {comentarios.map((c) => (
        <ComentarioCard
          key={c.id}
          comentario={c}
          pessoas={pessoas}
          destacado={c.id === destacadoId}
          onExcluir={onExcluir && podeExcluir(c) ? () => excluir(c.id) : undefined}
        />
      ))}
    </>
  );
}

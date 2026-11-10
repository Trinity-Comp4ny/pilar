import { ComentarioCard, type ComentarioExibido } from "./ComentarioCard";
import { useComentarioAutoria } from "@/hooks/useComentarioAutoria";

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
}: ComentariosListaProps) {
  const { podeExcluir } = useComentarioAutoria(autorNome);

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
          onExcluir={onExcluir && podeExcluir(c) ? () => onExcluir(c.id) : undefined}
        />
      ))}
    </>
  );
}

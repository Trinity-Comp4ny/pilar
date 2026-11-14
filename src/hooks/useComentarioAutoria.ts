import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { podeExcluirComentario, type ComentarioAutoria } from "@/lib/comentarios";

/**
 * Autoria dos comentários das Atividades: o `autorId` a gravar no comentário novo e
 * a regra de quem pode apagar (admin/coordenador qualquer um; demais só os próprios).
 * `autorNome` é o nome com que a tela assina os comentários (cobre os antigos sem id).
 */
export function useComentarioAutoria(autorNome?: string) {
  const { profile } = useAuth();
  const { role } = usePermissions();
  const autorId = profile?.id ?? undefined;
  const nomePerfil = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();

  const podeExcluir = useCallback(
    (c: ComentarioAutoria) =>
      podeExcluirComentario(c, { id: autorId, role, nomes: [autorNome, nomePerfil, profile?.email] }),
    [autorId, role, autorNome, nomePerfil, profile?.email]
  );

  return { autorId, podeExcluir };
}

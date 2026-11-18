import { Button } from "@/components/ui/button";
import { ComentariosLista } from "@/components/atividades/ComentariosLista";
import { AtividadeComposer } from "@/components/atividades/AtividadeComposer";
import { useLeadPessoas } from "../hooks/useLeadPessoas";
import { useLeadAtividades } from "../hooks/useLeadAtividades";
import { useAuth } from "@/contexts/AuthContext";
import { BusyMark } from "@/components/motion/BusyMark";

export function LeadAtividadesPanel({
  leadId,
  canEdit,
  comentarioDestacado,
}: {
  leadId: string;
  canEdit: boolean;
  comentarioDestacado?: string | null;
}) {
  const { profile } = useAuth();
  const { data = [], isLoading, isError, refetch, adicionar, excluir } = useLeadAtividades(leadId);
  const { data: pessoas = [] } = useLeadPessoas();
  const autorNome = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
  const comentarios = data.map((a) => ({
    id: a.id,
    texto: a.texto,
    autor: a.autor_nome,
    autorId: a.autor_id,
    data: a.ocorrido_em,
    mencionados: a.mencionados,
  }));

  return (
    <section aria-label="Atividades do lead" className="flex h-full min-h-0 flex-col gap-3 p-4">
      <h3 className="text-sm font-semibold">Atividades</h3>
      <p className="text-xs text-muted-foreground">
        Registre reuniões, contatos e o que ficou combinado. As notas do cadastro continuam no resumo.
      </p>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto" aria-live="polite">
        {isLoading ? (
          <BusyMark />
        ) : isError ? (
          <div role="alert" className="text-sm">
            Não foi possível carregar as atividades.
            <Button variant="ghost" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <ComentariosLista
            comentarios={comentarios}
            pessoas={pessoas}
            autorNome={autorNome}
            destacadoId={comentarioDestacado}
            vazio="Nenhuma atividade registrada"
            onExcluir={canEdit ? (id) => excluir.mutateAsync(id) : undefined}
          />
        )}
      </div>
      {canEdit && (
        <div className="space-y-3 border-t pt-3">
          <AtividadeComposer
            pessoas={pessoas}
            placeholder="O que aconteceu com este lead?"
            onSubmit={async (texto, mencionados) => {
              await adicionar.mutateAsync({ texto, mencionados });
            }}
          />
        </div>
      )}
    </section>
  );
}

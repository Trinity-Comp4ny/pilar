import { useQueryClient } from "@tanstack/react-query";
import { revisoesPendentesKey } from "../hooks/useRevisoesPendentes";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EntregaFormDialog } from "@/components/portal/EntregaFormDialog";
import { EntregasContent, type Entrega } from "@/components/portal/PortalEntregas";
import { NovoAditivoProjeto } from "@/components/AditivoProjetoDialogs";
import { useOrigensAditivos, type OrigemAditivo } from "@/hooks/useAditivosProjeto";
import { usePermissions } from "@/hooks/usePermissions";

export function ProjetoRevisoesTab({
  projetoId,
  revisoesInternas,
  abrirDisciplinas,
  criarTarefa,
  podeCriarAditivo = false,
  abrirAditivos,
}: {
  projetoId: string;
  revisoesInternas: number;
  abrirDisciplinas: () => void;
  criarTarefa?: (entrega: Entrega) => void;
  podeCriarAditivo?: boolean;
  abrirAditivos?: (id?: string) => void;
}) {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const podePublicar = can("portal_cliente", "edit");
  const [publicacao, setPublicacao] = useState<{ anterior?: Entrega } | null>(null);
  const [atualizacao, setAtualizacao] = useState(0);
  const [aditivo, setAditivo] = useState<OrigemAditivo | null>(null);
  const { data: aditivos = [] } = useOrigensAditivos(projetoId, !!abrirAditivos);
  const acoesEntrega = (entrega: Entrega) => {
    const vinculados = aditivos.filter((a) => a.origem.entrega_id === entrega.id);
    return (
      <div className="flex flex-wrap items-center gap-2">
        {podeCriarAditivo && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setAditivo({
                entregaId: entrega.id,
                disciplinaId: entrega.projeto_disciplina_id ?? undefined,
                descricao: entrega.titulo.slice(0, 250),
                motivo: (entrega.resposta_cliente ?? entrega.descricao)?.slice(0, 4000),
              })
            }
          >
            Criar aditivo
          </Button>
        )}
        {vinculados.map((item) => (
          <Button key={item.id} variant="ghost" size="sm" onClick={() => abrirAditivos?.(item.id ?? undefined)}>
            Aditivo · {item.titulo}
          </Button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" onClick={abrirDisciplinas}>
          Revisões internas abertas ({revisoesInternas})
        </Button>
        {podePublicar && (
          <Button variant="brand" onClick={() => setPublicacao({})}>
            Publicar revisão
          </Button>
        )}
      </div>
      <EntregasContent
        key={atualizacao}
        projetoId={projetoId}
        readOnly
        apenasRevisoes
        onCriarTarefa={criarTarefa}
        acoesEntrega={podeCriarAditivo || aditivos.length ? acoesEntrega : undefined}
        onPublicarRevisao={podePublicar ? (anterior) => setPublicacao({ anterior }) : undefined}
      />
      {aditivo && <NovoAditivoProjeto projetoId={projetoId} origem={aditivo} fechar={() => setAditivo(null)} />}
      {publicacao && (
        <EntregaFormDialog
          open
          onOpenChange={(aberto) => {
            if (!aberto) setPublicacao(null);
          }}
          projetoId={projetoId}
          publicarRevisao
          anterior={publicacao.anterior}
          onCreated={() => {
            setAtualizacao((valor) => valor + 1);
            void queryClient.invalidateQueries({ queryKey: revisoesPendentesKey(projetoId) });
            void queryClient.invalidateQueries({ queryKey: ["projeto-timeline", projetoId] });
          }}
        />
      )}
    </div>
  );
}

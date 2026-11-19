import { useQueryClient } from "@tanstack/react-query";
import { revisoesPendentesKey } from "../hooks/useRevisoesPendentes";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EntregaFormDialog } from "@/components/portal/EntregaFormDialog";
import { EntregasContent, type Entrega } from "@/components/portal/PortalEntregas";
import { usePermissions } from "@/hooks/usePermissions";

export function ProjetoRevisoesTab({
  projetoId,
  revisoesInternas,
  abrirDisciplinas,
  criarTarefa,
}: {
  projetoId: string;
  revisoesInternas: number;
  abrirDisciplinas: () => void;
  criarTarefa?: (entrega: Entrega) => void;
}) {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const podePublicar = can("portal_cliente", "edit");
  const [publicacao, setPublicacao] = useState<{ anterior?: Entrega } | null>(null);
  const [atualizacao, setAtualizacao] = useState(0);

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
        onPublicarRevisao={podePublicar ? (anterior) => setPublicacao({ anterior }) : undefined}
      />
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
          }}
        />
      )}
    </div>
  );
}

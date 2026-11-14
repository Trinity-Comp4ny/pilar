import { useState } from "react";
import { Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ConversaPortal } from "@/components/portal/ConversaPortal";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { EntregasContent } from "@/components/portal/PortalEntregas";
import { EntregaFormDialog } from "@/components/portal/EntregaFormDialog";

/**
 * Aba do escritório: pede algo ao cliente (aprovação, documento, informação) e acompanha a resposta.
 * O cliente vê o pedido em Pendências no portal. Vale para projeto ou obra.
 */
export function SolicitacoesDoCliente({ projetoId, obraId }: { projetoId?: string; obraId?: string }) {
  const { can } = usePermissions();
  const podeCriar = can("portal_cliente", "edit");
  const [aberto, setAberto] = useState(false);
  const [versao, setVersao] = useState(0);

  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-label="Conversa com o cliente">
        <div>
          <h2 className="text-sm font-semibold">Conversa com o cliente</h2>
          <p className="text-sm text-muted-foreground">
            O cliente escreve pelo botão "Falar com o escritório" do portal. Você responde aqui e ele é avisado por
            e-mail. Nota interna fica só para a equipe.
          </p>
        </div>
        <Card>
          <CardContent className="p-4">
            <ConversaPortal lado="equipe" escopo={{ projetoId, obraId }} className="max-h-[32rem]" />
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Solicitações</h2>
          <p className="text-sm text-muted-foreground">
            O que você pede aqui aparece nas Pendências do portal do cliente, com Aprovar e Solicitar revisão.
          </p>
        </div>
        {podeCriar && (
          <Button variant="brand" size="sm" onClick={() => setAberto(true)}>
            <Send className="mr-1.5 h-4 w-4" />
            Solicitar ao cliente
          </Button>
        )}
      </div>

      <EntregasContent key={versao} projetoId={projetoId} obraId={obraId} readOnly />

      <EntregaFormDialog
        open={aberto}
        onOpenChange={setAberto}
        projetoId={projetoId}
        obraId={obraId}
        onCreated={() => setVersao((v) => v + 1)}
      />
    </div>
  );
}

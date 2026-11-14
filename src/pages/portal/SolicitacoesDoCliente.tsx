import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { EntregasContent } from "./PortalEntregas";
import { EntregaFormDialog } from "./EntregaFormDialog";

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          O que você pede aqui aparece nas Pendências do portal do cliente, com Aprovar e Solicitar revisão.
        </p>
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

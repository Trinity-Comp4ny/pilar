import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ConversaPortal } from "@/components/portal/ConversaPortal";
import { useNaoLidasCliente } from "@/components/portal/useConversaPortal";

/**
 * Botão fixo "Falar com o escritório" do portal (BEZ-575): abre a conversa do projeto ou da obra
 * numa gaveta, de qualquer aba, sem tirar o cliente do que ele está olhando.
 */
export function FaleComEscritorio({
  projetoId,
  obraId,
  titulo,
}: {
  projetoId?: string;
  obraId?: string;
  titulo?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const naoLidas = useNaoLidasCliente();
  // Só as mensagens soltas deste projeto/obra: as dos fios aparecem em cada solicitação.
  const novas = (naoLidas.data ?? [])
    .filter((n) => !n.entrega_id && (projetoId ? n.projeto_id === projetoId : n.obra_id === obraId))
    .reduce((soma, n) => soma + n.total, 0);

  return (
    <>
      <Button
        variant="brand"
        size="lg"
        className="fixed bottom-4 right-4 z-40 h-12 gap-2 rounded-full px-5 shadow-card sm:bottom-6 sm:right-6"
        onClick={() => setAberto(true)}
      >
        <MessageSquare className="h-5 w-5" />
        <span>Falar com o escritório</span>
        {novas > 0 && (
          <span
            className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1.5 text-[11px] font-semibold text-white"
            aria-label={`${novas} mensagem${novas === 1 ? "" : "ns"} nova${novas === 1 ? "" : "s"}`}
          >
            {novas}
          </span>
        )}
      </Button>

      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Conversa com o escritório</SheetTitle>
            <SheetDescription>
              {titulo ? `${titulo}. ` : ""}Respondemos por aqui e avisamos você por e-mail.
            </SheetDescription>
          </SheetHeader>
          <ConversaPortal lado="cliente" escopo={{ projetoId, obraId }} ativo={aberto} className="flex-1" />
        </SheetContent>
      </Sheet>
    </>
  );
}

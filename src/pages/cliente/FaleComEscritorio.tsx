import { useEffect, useRef, useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConversaPortal } from "@/components/portal/ConversaPortal";
import { useNaoLidasCliente } from "@/components/portal/useConversaPortal";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAreaVisivel } from "@/hooks/useAreaVisivel";

/**
 * Botão fixo "Falar com o escritório" do portal (BEZ-575). Abre a conversa do projeto ou da obra num
 * painel flutuante, no mesmo padrão do painel "Dúvidas" da plataforma (AgenteAjuda): cartão com sombra
 * ancorado no canto, sem escurecer a tela, e tela cheia no celular acompanhando o teclado.
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
  const painel = useRef<HTMLElement>(null);
  const isMobile = useIsMobile();
  const area = useAreaVisivel();
  const naoLidas = useNaoLidasCliente();
  // Só as mensagens soltas deste projeto/obra.
  const novas = (naoLidas.data ?? [])
    .filter((n) => !n.entrega_id && (projetoId ? n.projeto_id === projetoId : n.obra_id === obraId))
    .reduce((soma, n) => soma + n.total, 0);

  useEffect(() => {
    if (aberto && isMobile) painel.current?.focus();
  }, [aberto, isMobile]);

  return (
    <>
      {aberto && (
        <section
          ref={painel}
          role="dialog"
          aria-label="Conversa com o escritório"
          tabIndex={-1}
          onKeyDown={(e) => e.key === "Escape" && setAberto(false)}
          style={
            isMobile && area
              ? {
                  top: `calc(${area.top}px + max(0.5rem, env(safe-area-inset-top)))`,
                  height: `calc(${area.height}px - max(0.5rem, env(safe-area-inset-top)) - 0.5rem)`,
                }
              : undefined
          }
          className="fixed inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] z-60 flex h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface-card shadow-elegant outline-hidden md:inset-x-auto md:bottom-20 md:right-6 md:top-auto md:z-50 md:h-[min(560px,calc(100dvh-8rem))] md:w-[380px]"
        >
          <div className="flex shrink-0 items-start justify-between gap-3 px-4 pt-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">Conversa com o escritório</h2>
              <p className="truncate text-xs text-ink-muted">
                {titulo ? `${titulo} · ` : ""}Respondemos por aqui e avisamos por e-mail
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAberto(false)}
              aria-label="Fechar"
              className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-muted hover:text-ink"
            >
              <X size={16} />
            </button>
          </div>
          <ConversaPortal
            lado="cliente"
            escopo={{ projetoId, obraId }}
            ativo={aberto}
            className="flex-1 px-4 pb-4 pt-3"
          />
        </section>
      )}

      {!(aberto && isMobile) && (
        <Button
          variant="brand"
          size="lg"
          className="fixed bottom-4 right-4 z-40 h-12 gap-2 rounded-full px-5 shadow-card sm:bottom-6 sm:right-6"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
        >
          <MessageSquare className="h-5 w-5" />
          <span>Falar com o escritório</span>
          {novas > 0 && !aberto && (
            <span
              className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1.5 text-[11px] font-semibold text-white"
              aria-label={`${novas} mensagem${novas === 1 ? "" : "ns"} nova${novas === 1 ? "" : "s"}`}
            >
              {novas}
            </span>
          )}
        </Button>
      )}
    </>
  );
}

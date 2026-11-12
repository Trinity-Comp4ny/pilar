import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useInstalarApp } from "@/hooks/useInstalarApp";
import { analytics } from "@/lib/analytics";
import { conviteDispensado, dispensarConvite, type PublicoApp } from "@/lib/instalarApp";
import { cn } from "@/lib/utils";

const TEXTO: Record<PublicoApp, string> = {
  escritorio: "Abre em tela cheia, sem procurar o link.",
  portal: "Seus projetos a um toque, sem procurar o link.",
};

interface ConviteInstalarAppProps {
  publico: PublicoApp;
  className?: string;
}

/**
 * Convite para pôr o Pilar na tela inicial, só no celular e só para quem ainda
 * abre pelo navegador. No Android com o evento do navegador, "Instalar" abre a
 * janela nativa; no iPhone (e no Android sem o evento), abre os passos. Fechar
 * esconde o convite por 60 dias neste navegador; o item "Instalar app" do menu
 * continua lá.
 */
export function ConviteInstalarApp({ publico, className }: ConviteInstalarAppProps) {
  const isMobile = useIsMobile();
  const { plataforma, disponivel, nativo, instalar, dialogo } = useInstalarApp(publico, "convite");
  const [dispensado, setDispensado] = useState(() => conviteDispensado());

  if (!isMobile || !disponivel || dispensado) return dialogo;

  const fechar = () => {
    dispensarConvite();
    setDispensado(true);
    analytics.track("app_instalar_dispensado", { plataforma, publico });
  };

  return (
    <>
      <section
        aria-label="Instalar o Pilar"
        className={cn(
          "relative flex items-center gap-3 rounded-3xl border border-border/60 bg-surface-card p-4 pr-11 shadow-card",
          className
        )}
      >
        <img src="/apple-touch-icon.png" alt="" aria-hidden="true" className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Tenha o Pilar na tela inicial</p>
          <p className="mt-0.5 text-xs text-ink-soft">{TEXTO[publico]}</p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => void instalar()}>
          {nativo ? "Instalar" : "Como instalar"}
        </Button>
        <button
          type="button"
          onClick={fechar}
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand/60"
          aria-label="Fechar convite para instalar"
        >
          <X size={16} />
        </button>
      </section>
      {dialogo}
    </>
  );
}

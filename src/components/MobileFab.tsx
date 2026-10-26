import { createPortal } from "react-dom";
import { Plus, type LucideIcon } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useBarraVisivel } from "@/hooks/useBarraVisivel";
import { cn } from "@/lib/utils";

interface MobileFabProps extends Pick<ButtonProps, "disabled" | "title"> {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  /** Âncora do coach mark de onboarding (vira [data-tour=...] no botão). */
  dataTour?: string;
}

/**
 * Ação principal da página no celular (SPEC 134): botão verde de 44px, texto e ícone pretos,
 * flutuando à direita acima da barra de baixo. Desce junto com a barra quando ela some ao
 * rolar. Só existe abaixo de `md`; no desktop a ação continua no cabeçalho (`PageHeader`).
 * Vai para o `body` por portal: o cabeçalho tem contexto de empilhamento próprio.
 */
export function MobileFab({ label, icon: Icon = Plus, onClick, dataTour, disabled, title }: MobileFabProps) {
  const barraVisivel = useBarraVisivel();
  if (typeof document === "undefined") return null;
  return createPortal(
    <Button
      type="button"
      variant="brand"
      onClick={onClick}
      disabled={disabled}
      title={title}
      data-tour={dataTour}
      className={cn(
        "fixed right-5 z-40 h-11 gap-1.5 rounded-full px-4 text-sm font-semibold shadow-[0_10px_24px_-10px_rgba(26,26,26,0.45)] transition-[bottom] duration-300 ease-out motion-reduce:transition-none md:hidden",
        barraVisivel
          ? "bottom-[calc(5.75rem+env(safe-area-inset-bottom))]"
          : "bottom-[calc(1.25rem+env(safe-area-inset-bottom))]"
      )}
    >
      <Icon size={18} strokeWidth={2.4} aria-hidden="true" />
      {label}
    </Button>,
    document.body
  );
}

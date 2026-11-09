import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { usePendenciasAgentes } from "@/hooks/useEscopos";

/**
 * Cartão de atenção do Início no celular (SPEC 134): como Agentes saiu da barra de baixo, as
 * pendências dos agentes aparecem aqui, com a ação de revisar. Só renderiza quando há pendência
 * e some a partir de `md`, onde Agentes continua no menu lateral.
 */
export function CartaoPendenciasAgentes() {
  const { data: pendencias } = usePendenciasAgentes();
  const total = pendencias?.length ?? 0;
  if (total === 0) return null;

  return (
    <Link
      to="/agentes"
      className="flex items-center justify-between gap-3 rounded-3xl border border-border/60 bg-white px-4 py-3.5 shadow-card focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand/60 md:hidden"
    >
      <span className="flex flex-col">
        <span className="text-sm font-semibold text-ink">
          {total === 1 ? "1 pendência dos agentes" : `${total} pendências dos agentes`}
        </span>
        <span className="text-xs text-muted-foreground">Revise e aprove o que eles prepararam</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

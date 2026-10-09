import { ReadingRing } from "./ReadingRing";

interface PageLoaderProps {
  /** Texto do que está carregando (ex.: "Carregando seus projetos"). Sem ele, só o anel. */
  label?: string;
  /** "page" ocupa a área de conteúdo; "section" cabe num card ou painel. */
  size?: "page" | "section" | "inline";
  className?: string;
}

const RING = { page: 112, section: 64, inline: 40 } as const;
const PAD = { page: "min-h-[60vh]", section: "py-10", inline: "py-4" } as const;

/**
 * Carregamento de página, seção ou card (ADR 0049): o anel de leitura centralizado,
 * com a legenda do que está vindo. Anuncia a espera para leitor de tela.
 */
export function PageLoader({ label, size = "section", className = "" }: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex w-full flex-col items-center justify-center gap-3 ${PAD[size]} ${className}`}
    >
      <ReadingRing size={RING[size]} />
      {label ? <p className="text-sm text-ink-muted">{label}</p> : <span className="sr-only">Carregando</span>}
    </div>
  );
}

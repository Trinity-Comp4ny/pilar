interface GridBackdropProps {
  /** `ink` para seções de fundo escuro, `paper` para as claras. */
  tom?: "paper" | "ink";
  /** Formato do recorte: `top` some para baixo, `center` some para as bordas. */
  mascara?: "top" | "center" | "bottom";
  className?: string;
}

const MASCARAS = {
  top: "radial-gradient(ellipse 80% 55% at 50% 0%, black 30%, transparent 100%)",
  center: "radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 100%)",
  bottom: "radial-gradient(ellipse 80% 60% at 50% 100%, black 25%, transparent 100%)",
};

/**
 * Malha de fundo decorativa. Substitui o `.hero-dot-grid` fixo por algo que as
 * seções escuras também possam usar, já que a cor da malha muda com o tom.
 */
export function GridBackdrop({ tom = "paper", mascara = "top", className }: GridBackdropProps) {
  const cor = tom === "ink" ? "rgba(255,255,255,0.07)" : "hsl(var(--text-ink) / 0.07)";

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none ${className ?? ""}`}
      style={{
        backgroundImage: `linear-gradient(${cor} 1px, transparent 1px), linear-gradient(90deg, ${cor} 1px, transparent 1px)`,
        backgroundSize: "56px 56px",
        maskImage: MASCARAS[mascara],
        WebkitMaskImage: MASCARAS[mascara],
      }}
    />
  );
}

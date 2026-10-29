import { PilarMark } from "@/components/motion/PilarMark";
import { PilarWordmark } from "@/components/motion/PilarWordmark";

type LogoVariant = "mark" | "full";
type LogoTone = "default" | "inverted";
type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";

const MARK_SIZE: Record<LogoSize, string> = {
  xs: "h-7 w-7",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
};

interface LogoProps {
  /** "mark": só o símbolo. "full": símbolo + nome. Default "full". */
  variant?: LogoVariant;
  /** "inverted" para fundo escuro (deixa o símbolo branco). Default "default". */
  tone?: LogoTone;
  size?: LogoSize;
  /** "draw": a marca se desenha uma vez ao montar (traço técnico, ADR 0049). */
  animate?: "draw";
  className?: string;
}

// No hover as caneluras ficam verdes uma a uma (só cor, nunca gira): .pilar-logo
// em src/styles/motion.css.
export function Logo({ variant = "full", tone = "default", size = "sm", animate, className = "" }: LogoProps) {
  return (
    <span
      className={`pilar-logo inline-flex items-center gap-3 ${tone === "inverted" ? "text-white" : ""} ${className}`}
    >
      <PilarMark
        variant={animate ?? "static"}
        title={variant === "mark" ? "Pilar" : undefined}
        className={`${MARK_SIZE[size]} shrink-0`}
      />
      {variant === "full" && <PilarWordmark size={size} />}
    </span>
  );
}

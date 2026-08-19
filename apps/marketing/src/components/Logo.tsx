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

const TEXT_SIZE: Record<LogoSize, string> = {
  xs: "text-base",
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-2xl",
  xl: "text-3xl",
};

interface LogoProps {
  /** "mark": só o símbolo. "full": símbolo + nome. Default "full". */
  variant?: LogoVariant;
  /** "inverted" para fundo escuro (deixa o símbolo branco). Default "default". */
  tone?: LogoTone;
  size?: LogoSize;
  className?: string;
}

export function Logo({ variant = "full", tone = "default", size = "sm", className = "" }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <img
        src="/pilar-logo.svg"
        alt={variant === "mark" ? "Pilar" : ""}
        className={`${MARK_SIZE[size]} shrink-0 hover:rotate-12 transition-transform duration-300 ${
          tone === "inverted" ? "brightness-0 invert" : ""
        }`}
      />
      {variant === "full" && <span className={`${TEXT_SIZE[size]} font-medium tracking-tight`}>Pilar</span>}
    </span>
  );
}

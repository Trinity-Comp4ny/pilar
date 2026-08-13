import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// Logo oficial do Google (SVG inline, 4 cores). Não usar ícone lucide genérico:
// o botão de OAuth do Google pede a marca reconhecível.
function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export function GoogleButton({
  onClick,
  loading = false,
  disabled = false,
  destaque = false,
}: {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Selo "usado por último" (tag do método anterior, spec 039). */
  destaque?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled || loading}
      className="relative w-full h-11 gap-2 border-paper-border text-ink-soft hover:text-ink hover:border-brand/50 hover:bg-brand/5 transition-all text-sm font-medium"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleLogo />}
      Continuar com Google
      {destaque && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-medium text-brand">
          usado por último
        </span>
      )}
    </Button>
  );
}

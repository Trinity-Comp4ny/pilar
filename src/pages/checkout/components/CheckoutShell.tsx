import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";

interface CheckoutShellProps {
  /** Rota do link "Voltar" no header — /planos no checkout público, /inicio no de tokens. */
  backTo: string;
  backLabel?: string;
  /** Destino do clique na logo — "/" (site público) ou "/inicio" (app autenticado). */
  logoTo: string;
  /** Texto do selo de segurança no canto direito do header. */
  badgeLabel?: string;
  children: ReactNode;
}

// Casco visual comum aos dois checkouts do Pilar: o de assinatura (público,
// /checkout) e o de compra de tokens (autenticado, /comprar-tokens). Extraído
// pra garantir que os dois sempre pareçam o mesmo produto — cabeçalho, fundo
// aurora e container ficam aqui; cada página monta o próprio grid de conteúdo.
export function CheckoutShell({
  backTo,
  backLabel = "Voltar",
  logoTo,
  badgeLabel = "Checkout seguro",
  children,
}: CheckoutShellProps) {
  return (
    <div className="landing-grain min-h-screen bg-paper text-ink-soft font-sans">
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-brand/5 rounded-full blur-[120px]" />
      </div>

      <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-md border-b border-paper-border">
        <div className="container mx-auto px-6 md:px-10 py-4 flex items-center justify-between">
          <Link
            to={backTo}
            className="flex items-center gap-2 text-ink-muted hover:text-brand transition-colors text-sm font-medium group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            {backLabel}
          </Link>

          <Link to={logoTo}>
            <Logo size="xs" className="text-ink-soft" />
          </Link>

          <div className="flex items-center gap-1 text-[11px] text-ink-disabled">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{badgeLabel}</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 md:px-10 py-10 max-w-5xl">{children}</main>
    </div>
  );
}

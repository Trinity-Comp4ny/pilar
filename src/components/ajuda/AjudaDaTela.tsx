import { HelpCircle } from "lucide-react";
import { Link, useInRouterContext, useLocation } from "react-router-dom";
import { artigosDaRota } from "@/lib/ajudaBusca";

/**
 * Botão "?" do cabeçalho (SPEC 154): leva ao artigo da tela aberta, ou à lista da tela quando
 * há mais de um. Tela sem artigo não mostra nada.
 */
export function AjudaDaTela() {
  // PageHeader também é montado em testes e telas sem router: sem router, sem botão.
  if (!useInRouterContext()) return null;
  return <AjudaDaTelaComRota />;
}

function AjudaDaTelaComRota() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/ajuda")) return null;
  const artigos = artigosDaRota(pathname);
  if (artigos.length === 0) return null;

  const destino = artigos.length === 1 ? `/ajuda/${artigos[0].slug}` : `/ajuda?tela=${encodeURIComponent(pathname)}`;
  return (
    <Link
      to={destino}
      aria-label="Ajuda desta tela"
      title="Ajuda desta tela"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-black/5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black/10"
    >
      <HelpCircle size={18} aria-hidden />
    </Link>
  );
}

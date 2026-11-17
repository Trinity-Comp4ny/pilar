import { Sparkles } from "lucide-react";
import { Link, useInRouterContext, useLocation } from "react-router-dom";
import { artigosDaRota } from "@/lib/ajudaBusca";
import { abrirAgenteAjuda } from "@/lib/agenteAjudaEvento";
import { useDentroDoMain } from "@/components/mainLandmark";

const classeBotao =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-black/5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black/10";

/**
 * Botão de dúvidas (ícone de agente) do cabeçalho (SPEC 154). É a porta única da ajuda no desktop: dentro do app abre o
 * painel "Dúvidas" (SPEC 155), que já sugere os artigos da tela e responde perguntas. Antes o
 * painel tinha uma pílula própria fixa no canto, por cima do conteúdo (auditoria de espaço,
 * 2026-11). Fora do shell (tela standalone, sem o painel montado), leva ao artigo da tela.
 */
export function AjudaDaTela() {
  // PageHeader também é montado em testes e telas sem router: sem router, sem botão.
  if (!useInRouterContext()) return null;
  return <AjudaDaTelaComRota />;
}

function AjudaDaTelaComRota() {
  const { pathname } = useLocation();
  const dentroDoApp = useDentroDoMain();
  if (pathname.startsWith("/ajuda")) return null;

  if (dentroDoApp) {
    return (
      <button
        type="button"
        onClick={abrirAgenteAjuda}
        aria-label="Dúvidas sobre esta tela"
        title="Dúvidas sobre esta tela"
        className={classeBotao}
      >
        <Sparkles size={18} aria-hidden />
      </button>
    );
  }

  const artigos = artigosDaRota(pathname);
  if (artigos.length === 0) return null;

  const destino = artigos.length === 1 ? `/ajuda/${artigos[0].slug}` : `/ajuda?tela=${encodeURIComponent(pathname)}`;
  return (
    <Link to={destino} aria-label="Ajuda desta tela" title="Ajuda desta tela" className={classeBotao}>
      <Sparkles size={18} aria-hidden />
    </Link>
  );
}

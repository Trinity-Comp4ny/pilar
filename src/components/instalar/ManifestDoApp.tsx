import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { MANIFEST_POR_PUBLICO, publicoDaRota } from "@/lib/instalarApp";

/**
 * Troca o manifest conforme o público da rota: o escritório instala o Pilar que
 * abre em /inicio; o cliente do portal instala o que abre em /cliente. Sem isso,
 * o cliente que instala pelo portal abriria o app na tela de login do escritório.
 * O título da tela inicial no iPhone (`apple-mobile-web-app-title`) acompanha.
 */
export function ManifestDoApp() {
  const { pathname } = useLocation();
  const publico = publicoDaRota(pathname);

  useEffect(() => {
    const { href, titulo } = MANIFEST_POR_PUBLICO[publico];
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (link && link.getAttribute("href") !== href) link.setAttribute("href", href);
    const meta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    if (meta && meta.content !== titulo) meta.content = titulo;
  }, [publico]);

  return null;
}

import { useEffect } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Scroll suave com inércia, no espírito do Lenis, escrito à mão.
 *
 * Em vez de puxar a biblioteca, intercepta a roda e interpola a posição num
 * `requestAnimationFrame`: são ~40 linhas contra ~10KB, e o resto da landing já
 * fala em transform/opacity, então não há nada para sincronizar.
 *
 * Fica fora do caminho quando não deve agir: `prefers-reduced-motion`, trackpad
 * de toque (que já tem inércia nativa), teclado e âncoras seguem o padrão do
 * navegador.
 */
export function SmoothScroll() {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    // Ponteiro grosso (toque) já rola com inércia própria: interceptar piora.
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let alvo = window.scrollY;
    let atual = window.scrollY;
    let raf = 0;
    let ativo = false;

    const limite = () => document.documentElement.scrollHeight - window.innerHeight;

    const passo = () => {
      // Interpolação exponencial: aproxima 12% da distância por quadro.
      atual += (alvo - atual) * 0.12;
      if (Math.abs(alvo - atual) < 0.35) {
        atual = alvo;
        ativo = false;
        window.scrollTo(0, atual);
        return;
      }
      window.scrollTo(0, atual);
      raf = requestAnimationFrame(passo);
    };

    const onWheel = (e: WheelEvent) => {
      // Zoom e scroll horizontal não são nossos.
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      alvo = Math.max(0, Math.min(limite(), alvo + e.deltaY));
      if (!ativo) {
        ativo = true;
        atual = window.scrollY;
        raf = requestAnimationFrame(passo);
      }
    };

    // Qualquer scroll que não veio da roda (teclado, âncora, barra) reposiciona
    // o alvo, senão o próximo giro puxaria a página de volta.
    const onScroll = () => {
      if (!ativo) alvo = window.scrollY;
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

  return null;
}

import { useEffect, useState } from "react";

/** Rolagem mínima (px) para contar como mudança de direção; evita tremer com o dedo parado. */
const FOLGA = 8;
/** Perto do topo a barra fica sempre visível. */
const TOPO = 64;
/** Teclado aberto: a área visível encolhe para menos que isto da janela. */
const FRACAO_COM_TECLADO = 0.75;

/**
 * Visibilidade da barra de baixo no celular (SPEC 134): some ao rolar para baixo,
 * volta ao rolar para cima ou no topo, e fica escondida com o teclado aberto.
 *
 * `scroll` não borbulha, então escuta na captura do documento: serve para qualquer
 * contêiner que role (o `main` do `PageLayout` rola, não a janela). Só escreve estado
 * quando a direção muda.
 */
export function useBarraVisivel(): boolean {
  const [visivel, setVisivel] = useState(true);

  useEffect(() => {
    const ultimo = new WeakMap<EventTarget, number>();
    let comTeclado = false;
    let rolandoParaBaixo = false;

    const aplicar = () => setVisivel(!comTeclado && !rolandoParaBaixo);

    const aoRolar = (e: Event) => {
      const alvo = e.target;
      if (!(alvo instanceof HTMLElement) && alvo !== document) return;
      const el = alvo === document ? document.scrollingElement : (alvo as HTMLElement);
      if (!el) return;
      const atual = el.scrollTop;
      const anterior = ultimo.get(alvo) ?? 0;
      const delta = atual - anterior;
      if (atual <= TOPO) {
        ultimo.set(alvo, atual);
        if (rolandoParaBaixo) {
          rolandoParaBaixo = false;
          aplicar();
        }
        return;
      }
      if (Math.abs(delta) < FOLGA) return;
      ultimo.set(alvo, atual);
      const paraBaixo = delta > 0;
      if (paraBaixo !== rolandoParaBaixo) {
        rolandoParaBaixo = paraBaixo;
        aplicar();
      }
    };

    const aoMudarTeclado = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const aberto = vv.height < window.innerHeight * FRACAO_COM_TECLADO;
      if (aberto !== comTeclado) {
        comTeclado = aberto;
        aplicar();
      }
    };

    document.addEventListener("scroll", aoRolar, { capture: true, passive: true });
    window.visualViewport?.addEventListener("resize", aoMudarTeclado);
    return () => {
      document.removeEventListener("scroll", aoRolar, { capture: true });
      window.visualViewport?.removeEventListener("resize", aoMudarTeclado);
    };
  }, []);

  return visivel;
}

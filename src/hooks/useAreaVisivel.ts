import { useSyncExternalStore } from "react";

export interface AreaVisivel {
  /** Distância (px) do topo da janela de layout até o topo do que está visível. */
  top: number;
  /** Altura (px) do que está visível: encolhe quando o teclado abre. */
  height: number;
}

function assinar(aoMudar: () => void) {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  vv.addEventListener("resize", aoMudar);
  vv.addEventListener("scroll", aoMudar);
  return () => {
    vv.removeEventListener("resize", aoMudar);
    vv.removeEventListener("scroll", aoMudar);
  };
}

// Instantâneo como texto: precisa ser estável entre leituras iguais (useSyncExternalStore).
function ler(): string {
  const vv = window.visualViewport;
  return vv ? `${Math.round(vv.offsetTop)}|${Math.round(vv.height)}` : "";
}

/**
 * Área da tela que a pessoa enxerga de fato (`visualViewport`). No celular, com o teclado
 * aberto, o iOS não encolhe a janela de layout: ele rola a página para cima e o painel
 * `fixed` vai junto, sumindo do alto da tela. Quem precisa ficar inteiro acima do teclado
 * (ex.: o chat de Dúvidas) se posiciona por esta área. `null` sem suporte no navegador.
 */
export function useAreaVisivel(): AreaVisivel | null {
  const instantaneo = useSyncExternalStore(assinar, ler, () => "");
  if (!instantaneo) return null;
  const [top, height] = instantaneo.split("|").map(Number);
  return { top, height };
}

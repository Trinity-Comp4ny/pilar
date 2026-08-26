/**
 * Moldura branca da janela.
 *
 * Quatro barras fixas nas bordas mais quatro cantos em SVG que arredondam o vão
 * interno. O conteúdo rola por baixo, então a página inteira lê como um cartão
 * encaixado na janela, e não como um documento que sangra até a borda.
 *
 * O CSS mora em index.css (`.site-frame`, `.site-corner`), porque as barras
 * precisam da largura em variável para o header se alinhar a elas.
 */

/** Canto côncavo: um quadrado do qual se subtrai o quarto de círculo interno. */
function Corner({ posicao }: { posicao: "tl" | "tr" | "bl" | "br" }) {
  const giro = { tl: 0, tr: 90, br: 180, bl: 270 }[posicao];
  const lado = {
    tl: { top: "var(--frame-w)", left: "var(--frame-w)" },
    tr: { top: "var(--frame-w)", right: "var(--frame-w)" },
    bl: { bottom: "var(--frame-w)", left: "var(--frame-w)" },
    br: { bottom: "var(--frame-w)", right: "var(--frame-w)" },
  }[posicao];

  return (
    <svg
      className="site-corner"
      style={{ ...lado, transform: `rotate(${giro}deg)` }}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path d="M0 0H32C14.327 0 0 14.327 0 32V0Z" fill="currentColor" />
    </svg>
  );
}

export function SiteFrame() {
  return (
    <div aria-hidden="true">
      <span className="site-frame site-frame--top" />
      <span className="site-frame site-frame--bottom" />
      <span className="site-frame site-frame--left" />
      <span className="site-frame site-frame--right" />
      <Corner posicao="tl" />
      <Corner posicao="tr" />
      <Corner posicao="bl" />
      <Corner posicao="br" />
    </div>
  );
}

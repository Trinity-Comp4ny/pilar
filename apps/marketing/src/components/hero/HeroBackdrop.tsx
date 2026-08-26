/**
 * Paisagem atrás da hero.
 *
 * A referência usa uma foto de montanha tratada com dithering. Aqui a mesma
 * ideia é gerada em SVG, sem imagem: camadas de morro em gradiente do verde da
 * marca, cobertas por uma trama de pontos que dá o grão do dithering. Pesa
 * ~2KB, escala em qualquer largura e não depende de arte externa.
 */
export function HeroBackdrop() {
  return (
    <div className="absolute inset-x-0 top-0 h-[720px] md:h-[860px] overflow-hidden" aria-hidden="true">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1440 860" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="ceu" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--surface-landing-white))" />
            <stop offset="62%" stopColor="hsl(190 60% 96%)" />
            <stop offset="100%" stopColor="hsl(var(--brand-accent) / 0.22)" />
          </linearGradient>
          <linearGradient id="morroLonge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(160 45% 78%)" />
            <stop offset="100%" stopColor="hsl(var(--brand-accent) / 0.7)" />
          </linearGradient>
          <linearGradient id="morroMeio" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--brand-accent))" />
            <stop offset="100%" stopColor="hsl(78 62% 58%)" />
          </linearGradient>
          <linearGradient id="morroPerto" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(88 55% 52%)" />
            <stop offset="100%" stopColor="hsl(96 42% 38%)" />
          </linearGradient>

          {/* Trama de pontos: é o que dá a textura de dithering por cima. */}
          <pattern id="trama" width="3" height="3" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.62" fill="hsl(var(--surface-landing-white))" />
          </pattern>
          {/* A trama some no alto e aparece embaixo, como grão de impressão. */}
          <linearGradient id="forcaTrama" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.75" />
            <stop offset="45%" stopColor="white" stopOpacity="0.42" />
            <stop offset="100%" stopColor="white" stopOpacity="0.2" />
          </linearGradient>
          <mask id="mascaraTrama">
            <rect width="1440" height="860" fill="url(#forcaTrama)" />
          </mask>

          {/* A paisagem inteira desvanece antes de encostar no conteúdo. */}
          <linearGradient id="dissolve" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="40%" stopColor="white" stopOpacity="0.5" />
            <stop offset="62%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="1" />
          </linearGradient>
          <mask id="mascaraDissolve">
            <rect width="1440" height="860" fill="url(#dissolve)" />
          </mask>
        </defs>

        <rect width="1440" height="860" fill="url(#ceu)" />

        <g mask="url(#mascaraDissolve)">
          <path
            d="M0 690 C160 640 260 664 400 652 C560 638 640 590 800 606 C960 622 1060 660 1200 648 C1320 638 1380 656 1440 668 V860 H0Z"
            fill="url(#morroLonge)"
            opacity="0.75"
          />
          <path
            d="M0 752 C180 714 300 742 460 730 C620 718 720 682 880 700 C1020 716 1140 744 1280 732 C1350 726 1400 736 1440 744 V860 H0Z"
            fill="url(#morroMeio)"
            opacity="0.8"
          />
          <path
            d="M0 806 C200 778 340 800 520 792 C700 784 800 758 980 772 C1140 784 1260 802 1440 794 V860 H0Z"
            fill="url(#morroPerto)"
            opacity="0.72"
          />
          <rect width="1440" height="860" fill="url(#trama)" mask="url(#mascaraTrama)" style={{ mixBlendMode: "screen" }} />
        </g>
      </svg>

      {/* Fecho em degradê para a cor da página, para não haver linha de corte. */}
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-b from-transparent to-paper" />
    </div>
  );
}

import { Suspense, lazy } from "react";

// Preguiçosos: só quem tem aviso para mostrar paga o download.
const AceiteTermosBanner = lazy(() =>
  import("@/components/AceiteTermosBanner").then((m) => ({ default: m.AceiteTermosBanner }))
);
const AceiteAnaliseCard = lazy(() =>
  import("@/components/AceiteAnaliseCard").then((m) => ({ default: m.AceiteAnaliseCard }))
);

/**
 * Canto inferior direito do app: os avisos que não bloqueiam a tela, empilhados (Termos atualizados
 * em cima, análise de uso embaixo). No celular sobe acima da barra de navegação. O contêiner não
 * captura toque; só os cartões capturam.
 */
export function AvisosDoCanto() {
  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-40 flex flex-col gap-3 md:bottom-4">
      <Suspense fallback={null}>
        <AceiteTermosBanner modo="faixa" />
        <AceiteAnaliseCard />
      </Suspense>
    </div>
  );
}

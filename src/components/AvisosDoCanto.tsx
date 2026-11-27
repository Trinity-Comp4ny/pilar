import { Suspense, lazy } from "react";

// Preguiçosos: só quem tem aviso para mostrar paga o download.
const AceiteTermosBanner = lazy(() =>
  import("@/components/AceiteTermosBanner").then((m) => ({ default: m.AceiteTermosBanner }))
);
const AceiteAnaliseCard = lazy(() =>
  import("@/components/AceiteAnaliseCard").then((m) => ({ default: m.AceiteAnaliseCard }))
);

/**
 * Canto inferior direito do app: os avisos que não bloqueiam a tela, (Termos atualizados
 * em cima, análise de uso embaixo). Quem posiciona é a `PilhaDoCanto`, junto com NPS e checklist.
 */
export function AvisosDoCanto() {
  return (
    <Suspense fallback={null}>
      <AceiteTermosBanner modo="faixa" />
      <AceiteAnaliseCard />
    </Suspense>
  );
}

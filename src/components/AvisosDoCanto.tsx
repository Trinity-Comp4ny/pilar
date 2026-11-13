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
 * em cima, análise de uso embaixo). Fica acima do botão do checklist de início (que mora no mesmo canto) e, no celular, também da barra de navegação; z-50 para não ficar atrás do PageLayout (fixo, opaco, z-40). O contêiner não
 * captura toque; só os cartões capturam.
 */
export function AvisosDoCanto() {
  return (
    <div className="pointer-events-none fixed bottom-36 right-4 z-50 flex flex-col gap-3 md:bottom-20">
      <Suspense fallback={null}>
        <AceiteTermosBanner modo="faixa" />
        <AceiteAnaliseCard />
      </Suspense>
    </div>
  );
}

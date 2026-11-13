import { Suspense, lazy, useEffect, useRef } from "react";
import { registrarAlvoFaixas } from "@/lib/faixasDoTopo";

// A faixa em si também é preguiçosa: traz o formatador de datas e os ícones dela.
const FaixaAvisos = lazy(() => import("@/components/FaixaAvisos").then((m) => ({ default: m.FaixaAvisos })));
/**
 * Faixas do topo: incidente e manutenção (SPEC 153/157). Aviso de Termos e de análise de uso moram no canto inferior direito (AvisosDoCanto).
 * Ficam num bloco fixo acima do conteúdo, e a altura dele vira `--faixas-h`, que o `<main>`
 * e o `PageLayout` usam para descer. Antes elas ficavam no fluxo do `<main>`, e o `PageLayout`
 * (camada fixa e opaca) as cobria em toda tela que o usa: o aviso de incidente não aparecia
 * (auditoria de espaço, 2026-11).
 */
export function FaixasDoTopo({ left }: { left: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const raiz = document.documentElement;
    const medir = () => raiz.style.setProperty("--faixas-h", `${el.offsetHeight}px`);
    medir();
    // jsdom (testes) não tem ResizeObserver: mede uma vez e segue.
    if (typeof ResizeObserver === "undefined") return () => raiz.style.removeProperty("--faixas-h");
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => {
      obs.disconnect();
      raiz.style.removeProperty("--faixas-h");
    };
  }, []);

  return (
    <div ref={ref} className="fixed right-0 top-0 z-50" style={{ left }}>
      {/* Somente leitura e "visualizando como" se encaixam aqui (lib/faixasDoTopo). */}
      <div ref={registrarAlvoFaixas} />
      {/* Incidente e manutenção declarados no Ultra admin (SPEC 153). */}
      <Suspense fallback={null}>
        <FaixaAvisos />
      </Suspense>
    </div>
  );
}

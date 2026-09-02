import { useLayoutEffect, useRef } from "react";
import { m, useInView, useReducedMotion } from "framer-motion";
import { EASE } from "../../lib/motion";
import { CursorAgente } from "./SceneParts";
import { AppSidebar, BarraNavegador } from "./SceneChrome";
import { TelaFinanceiro, TelaLeads, TelaProjeto } from "./SceneScreens";
import { TelaAgentes } from "./TelaAgentes";
import { HeroSceneMobile } from "./HeroSceneMobile";
import { CURSOR, DURACAO_LOOP, MARCOS, PALCO, ATOS, idx, telaDoAto } from "./scene";
import { useAbaVisivel, useScene } from "./useScene";

/** Ajusta a escala do palco fixo para a largura real do container. */
function useEscala(alvo: React.RefObject<HTMLDivElement>) {
  useLayoutEffect(() => {
    const el = alvo.current;
    if (!el) return;

    const aplicar = (largura: number) => el.style.setProperty("--escala", String(largura / PALCO.largura));
    aplicar(el.getBoundingClientRect().width);

    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entrada]) => aplicar(entrada.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [alvo]);
}

/**
 * A cena da hero: uma sessão contínua no Pilar conduzida por um agente, em loop
 * de ~20 segundos, sem aba nem clique do visitante (SPEC 072).
 *
 * Substitui o `ProductTour`, que dividia a atenção em três telas e exigia
 * esperar 7 segundos por aba para entender qualquer coisa.
 *
 * É animação em código, não vídeo: fica nítida em retina, pesa alguns KB em vez
 * de megabytes, e continua editável quando o produto mudar. Se um dia entrar
 * gravação de tela real, ela substitui só este componente.
 */
export function HeroScene() {
  // `palco` mede a versão de desktop para calcular a escala; `raiz` observa a
  // visibilidade. São refs separadas de propósito: abaixo de `md` o palco fica
  // com `display: none`, e um observador nele nunca dispararia: a cena de
  // celular jamais sairia do primeiro ato.
  const raiz = useRef<HTMLDivElement>(null);
  const palco = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const emVista = useInView(raiz, { amount: 0.25 });
  const abaVisivel = useAbaVisivel();

  useEscala(palco);

  const ativo = emVista && abaVisivel && !reducedMotion;
  const relogio = useScene(MARCOS, DURACAO_LOOP, ativo);

  // Sem animação, o palco congela no quadro que conta mais história de uma vez:
  // o pedido escrito, o funil atrás e o rascunho esperando aprovação.
  const ato = reducedMotion ? idx("rascunho") : relogio;
  const tela = telaDoAto(ato);
  const cursor = CURSOR[ATOS[ato]];

  return (
    <div ref={raiz} className="relative">
      {/* Halo de cor atrás da janela: dá profundidade sem pintar a página. */}
      <div aria-hidden="true" className="absolute -inset-x-10 -top-6 bottom-10 -z-10">
        <div className="absolute left-[8%] top-0 w-[42%] h-[70%] rounded-full bg-modulo-gestao/50 blur-[90px]" />
        <div className="absolute right-[6%] top-[12%] w-[38%] h-[62%] rounded-full bg-modulo-projetos/45 blur-[90px]" />
      </div>

      {/* Abaixo de `md` o palco de 1120px escalaria para ~0,3 e nada seria
          legível, então a mesma história roda em retrato. */}
      <div className="md:hidden">
        <HeroSceneMobile ato={ato} estatico={!!reducedMotion} />
      </div>

      <div
        ref={palco}
        aria-hidden="true"
        className="relative hidden md:block w-full overflow-hidden rounded-[18px] border border-paper-border bg-white shadow-[0_2px_4px_rgba(0,0,0,0.04),0_28px_70px_-28px_rgba(0,0,0,0.35)]"
        style={{ aspectRatio: `${PALCO.largura} / ${PALCO.altura}` }}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ width: PALCO.largura, height: PALCO.altura, transform: "scale(var(--escala, 1))" }}
        >
          <BarraNavegador />

          <div className="flex" style={{ height: PALCO.altura - 40 }}>
            <AppSidebar ato={ato} />

            <div className="relative flex-1 overflow-hidden">
              {/* Uma tela por vez, com troca suave: é o agente navegando, não um
                  carrossel. `key` remonta o conteúdo, então cada tela reanima. */}
              <m.div
                key={tela}
                className="absolute inset-0"
                initial={reducedMotion ? false : { opacity: 0, x: 18, filter: "blur(6px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.5, ease: EASE.out }}
              >
                {tela === "agentes" && <TelaAgentes ato={ato} />}
                {tela === "funil" && <TelaLeads ato={ato} />}
                {tela === "financeiro" && <TelaFinanceiro ato={ato} />}
                {tela === "projeto" && <TelaProjeto ato={ato} />}
              </m.div>
            </div>
          </div>

          <CursorAgente ato={ato} x={cursor.x} y={cursor.y} rotulo={cursor.rotulo} />
        </div>
      </div>

      {/* Equivalente textual: a cena é decorativa para quem enxerga, mas a
          história precisa chegar em quem usa leitor de tela. */}
      <p className="sr-only">
        Demonstração do Pilar: um agente de IA recebe o pedido em português "recebi 128 mil do centro cirúrgico,
        primeira de três parcelas", monta o lançamento financeiro como rascunho para aprovação, move o lead para ganho
        no funil, registra a receita no financeiro do mês e recalcula a margem prevista do projeto em 31,4%.
      </p>
    </div>
  );
}

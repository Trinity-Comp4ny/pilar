import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { haptico, hapticoDeMutation, iniciarRastroDeToque } from "@/lib/haptico";
import { PilarMark } from "@/components/motion/PilarMark";
import {
  LIMIAR_PUXAR,
  MINIMO_ATUALIZANDO_MS,
  POSICAO_ATUALIZANDO,
  SELETOR_SOBREPOSICAO,
  alvoTratoGestoProprio,
  amortecer,
  podeIniciarPuxar,
  progressoDoPuxar,
} from "@/lib/puxarParaAtualizar";

/**
 * Puxe para atualizar, no sistema inteiro (celular). Com a página no topo, puxar para baixo
 * mostra a marca e, ao soltar, refaz as consultas das telas abertas (`invalidateQueries`),
 * sem recarregar o app: estado, rascunho e navegação ficam como estão.
 *
 * Por que próprio: o app instalado (PWA) não tem o gesto nativo, e no Chrome do Android o nativo
 * recarrega a página inteira. `overscroll-behavior-y: contain` (index.css) cala o nativo.
 *
 * Fica de fora quem trata o gesto sozinho: mapa, campos de texto, kanban/arraste, áreas que rolam
 * por dentro e qualquer diálogo/sheet aberto. Marque `data-no-ptr` para excluir mais uma área.
 */
export function PullToRefresh() {
  const queryClient = useQueryClient();
  const indicador = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<"ocioso" | "atualizando">("ocioso");
  const atualizando = useRef(false);

  useEffect(() => {
    if (!window.matchMedia?.("(pointer: coarse)").matches) return;

    // Mesmo gancho do celular: vibra quando uma ação da pessoa (mutation) conclui ou falha.
    const pararToque = iniciarRastroDeToque();
    const pararMutations = queryClient.getMutationCache().subscribe((evento) => {
      if (evento.type !== "updated") return;
      const acao = evento.action.type;
      if (acao === "success" || acao === "error") {
        hapticoDeMutation(acao === "success" ? "sucesso" : "erro", evento.mutation.meta);
      }
    });

    let inicioY = 0;
    let inicioX = 0;
    let puxando = false;
    let rastreando = false;
    let distancia = 0;
    let passouLimiar = false;
    const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const pintar = (y: number, animar: boolean) => {
      const el = indicador.current;
      if (!el) return;
      el.style.transition = animar && !reduzMovimento ? "transform 0.22s ease-out, opacity 0.22s ease-out" : "none";
      el.style.transform = `translate3d(-50%, ${y}px, 0)`;
      el.style.opacity = String(y <= 0 ? 0 : Math.min(1, progressoDoPuxar(y) + 0.15));
    };
    const desenharTraco = (progresso: number) => {
      indicador.current?.style.setProperty("--ptr-progresso", String(progresso));
    };

    const aoTocar = (e: TouchEvent) => {
      rastreando = false;
      puxando = false;
      if (atualizando.current || e.touches.length !== 1) return;
      const ok = podeIniciarPuxar({
        scrollY: window.scrollY,
        sobreposicaoAberta: !!document.querySelector(SELETOR_SOBREPOSICAO),
        alvoProprio: alvoTratoGestoProprio(e.target),
      });
      if (!ok) return;
      inicioY = e.touches[0].clientY;
      inicioX = e.touches[0].clientX;
      distancia = 0;
      passouLimiar = false;
      rastreando = true;
    };

    const aoMover = (e: TouchEvent) => {
      if (!rastreando) return;
      const dy = e.touches[0].clientY - inicioY;
      const dx = e.touches[0].clientX - inicioX;
      if (!puxando) {
        // Gesto horizontal, subida ou a página saiu do topo: não é puxar.
        if (dy < 0 || window.scrollY > 0 || Math.abs(dx) > Math.abs(dy)) {
          if (dy < 0 || Math.abs(dx) > Math.abs(dy)) rastreando = false;
          return;
        }
        if (dy < 8) return;
        puxando = true;
      }
      if (e.cancelable) e.preventDefault();
      distancia = amortecer(dy);
      pintar(distancia, false);
      desenharTraco(progressoDoPuxar(distancia));
      const agora = distancia >= LIMIAR_PUXAR;
      if (agora && !passouLimiar) haptico("leve");
      passouLimiar = agora;
    };

    const aoSoltar = async () => {
      if (!puxando) {
        rastreando = false;
        return;
      }
      rastreando = false;
      puxando = false;
      if (distancia < LIMIAR_PUXAR) {
        pintar(0, true);
        return;
      }
      atualizando.current = true;
      setEstado("atualizando");
      pintar(POSICAO_ATUALIZANDO, true);
      try {
        await Promise.all([
          queryClient.invalidateQueries({ type: "active" }),
          new Promise((r) => window.setTimeout(r, MINIMO_ATUALIZANDO_MS)),
        ]);
      } finally {
        atualizando.current = false;
        setEstado("ocioso");
        pintar(0, true);
      }
    };

    const aoCancelar = () => {
      if (puxando) pintar(0, true);
      rastreando = false;
      puxando = false;
    };

    document.addEventListener("touchstart", aoTocar, { passive: true });
    document.addEventListener("touchmove", aoMover, { passive: false });
    document.addEventListener("touchend", aoSoltar, { passive: true });
    document.addEventListener("touchcancel", aoCancelar, { passive: true });
    return () => {
      document.removeEventListener("touchstart", aoTocar);
      document.removeEventListener("touchmove", aoMover);
      document.removeEventListener("touchend", aoSoltar);
      document.removeEventListener("touchcancel", aoCancelar);
      pararToque();
      pararMutations();
    };
  }, [queryClient]);

  return (
    <div
      ref={indicador}
      aria-hidden={estado === "ocioso"}
      role="status"
      aria-label={estado === "atualizando" ? "Atualizando" : undefined}
      className="pointer-events-none fixed left-1/2 top-0 z-40 flex size-10 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-md"
      style={{ transform: "translate3d(-50%, 0, 0)", opacity: 0, marginTop: "calc(env(safe-area-inset-top) - 2.5rem)" }}
    >
      <PilarMark variant={estado === "atualizando" ? "rhythm" : "static"} weight={2.4} className="w-5" />
    </div>
  );
}
